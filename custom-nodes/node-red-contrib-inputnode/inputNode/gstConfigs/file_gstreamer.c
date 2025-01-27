#include <gst/gst.h>
#include <stdio.h>
#include <stdlib.h>

#ifdef __APPLE__
#include <TargetConditionals.h>
#endif

void on_pad_added(GstElement *src, GstPad *pad, gpointer data) {
    GstElement *sink = (GstElement *)data;
    GstPad *sinkpad = gst_element_get_static_pad(sink, "sink");

    if (gst_pad_is_linked(sinkpad)) {
        gst_object_unref(sinkpad);
        return; 
    }

    GstPadLinkReturn link_return = gst_pad_link(pad, sinkpad);
    if (link_return != GST_PAD_LINK_OK) {
        g_printerr("Failed to link pads: %s\n", gst_pad_link_get_name(link_return));
    }

    gst_object_unref(sinkpad);
}

static void on_new_sample(GstElement *sink, gpointer user_data) {
    GstSample *sample;
    g_signal_emit_by_name(sink, "pull-sample", &sample);

    if (sample) {
        GstBuffer *buffer = gst_sample_get_buffer(sample);
        GstCaps *caps = gst_sample_get_caps(sample);
        GstMapInfo info;

        if (gst_buffer_map(buffer, &info, GST_MAP_READ)) {
            fwrite(info.data, 1, info.size, stdout);
            fflush(stdout); 

            gst_buffer_unmap(buffer, &info);
        }

        gst_sample_unref(sample);
    }
}

int file_main(int argc, char *argv[]) {
    GstElement *pipeline, *source, *demuxer, *video_decoder, *video_rate, *jpeg_encoder, *jpeg_sink;
    GstBus *bus;
    GstMessage *msg;
    GstStateChangeReturn ret;

    if (argc < 3) {
        g_printerr("Usage: %s <video_file> <frame_rate>\n", argv[0]);
        return -1;
    }

    int frame_rate = atoi(argv[2]);
    if (frame_rate <= 0) {
        g_printerr("Invalid frame rate: %d. Please provide a positive integer.\n", frame_rate);
        return -1;
    }

    gst_init(&argc, &argv);

    source = gst_element_factory_make("filesrc", "source");
    g_object_set(source, "location", argv[1], NULL);  

    demuxer = gst_element_factory_make("qtdemux", "demuxer");
    video_decoder = gst_element_factory_make("avdec_h264", "video_decoder"); // Assuming input is H264, change if needed
    video_rate = gst_element_factory_make("videorate", "video_rate");
    jpeg_encoder = gst_element_factory_make("jpegenc", "jpeg_encoder");
    jpeg_sink = gst_element_factory_make("appsink", "jpeg_sink");

    pipeline = gst_pipeline_new("video-pipeline");

    if (!pipeline || !source || !demuxer || !video_decoder || !video_rate || !jpeg_encoder || !jpeg_sink) {
        g_printerr("Not all elements could be created.\n");
        return -1;
    }

    g_object_set(video_rate, "max-rate", frame_rate, NULL);

    g_object_set(jpeg_sink, "emit-signals", TRUE, NULL);
    g_signal_connect(jpeg_sink, "new-sample", G_CALLBACK(on_new_sample), NULL);

    gst_bin_add_many(GST_BIN(pipeline), source, demuxer, video_decoder, video_rate, jpeg_encoder, jpeg_sink, NULL);
    gst_element_link(source, demuxer);
    g_signal_connect(demuxer, "pad-added", G_CALLBACK(on_pad_added), video_decoder);
    gst_element_link(video_decoder, video_rate);
    gst_element_link(video_rate, jpeg_encoder);
    gst_element_link(jpeg_encoder, jpeg_sink);

    ret = gst_element_set_state(pipeline, GST_STATE_PLAYING);
    if (ret == GST_STATE_CHANGE_FAILURE) {
        g_printerr("Unable to set the pipeline to the playing state.\n");
        gst_object_unref(pipeline);
        return -1;
    }

    bus = gst_element_get_bus(pipeline);
    msg = gst_bus_timed_pop_filtered(bus, GST_CLOCK_TIME_NONE, GST_MESSAGE_ERROR | GST_MESSAGE_EOS);

    if (msg != NULL) {
        GError *err;
        gchar *debug_info;

        switch (GST_MESSAGE_TYPE(msg)) {
            case GST_MESSAGE_ERROR:
                gst_message_parse_error(msg, &err, &debug_info);
                g_printerr("Error received from element %s: %s\n", GST_OBJECT_NAME(msg->src), err->message);
                g_printerr("Debugging information: %s\n", debug_info ? debug_info : "none");
                g_clear_error(&err);
                g_free(debug_info);
                break;
            case GST_MESSAGE_EOS:
                g_print("End-Of-Stream reached.\n");
                break;
            default:
                g_printerr("Unexpected message received.\n");
                break;
        }
        gst_message_unref(msg);
    }

    gst_object_unref(bus);
    gst_element_set_state(pipeline, GST_STATE_NULL);
    gst_object_unref(pipeline);
    return 0;
}

int main(int argc, char *argv[]) {
#if defined(__APPLE__) && TARGET_OS_MAC && !TARGET_OS_IPHONE
    return gst_macos_main((GstMainFunc) file_main, argc, argv, NULL);
#else
    return file_main(argc, argv);
#endif
}
