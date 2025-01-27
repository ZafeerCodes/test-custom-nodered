#include <gst/gst.h>
#include <stdio.h>
#include <stdlib.h>

#ifdef __APPLE__
#include <TargetConditionals.h>
#endif

void on_pad_added(GstElement *src, GstPad *pad, gpointer data) {
    GstElement *sink = (GstElement *)data;
    GstPad *sinkpad = gst_element_get_static_pad(sink, "sink");
    gst_pad_link(pad, sinkpad);
    gst_object_unref(sinkpad);
}

GstFlowReturn on_new_sample(GstElement *sink, gpointer user_data) {
    GstSample *sample;
    GstBuffer *buffer;
    GstMapInfo map;

    g_signal_emit_by_name(sink, "pull-sample", &sample);
    if (!sample) {
        return GST_FLOW_ERROR;
    }

    buffer = gst_sample_get_buffer(sample);
    gst_buffer_map(buffer, &map, GST_MAP_READ);

    fwrite(map.data, 1, map.size, stdout);

    gst_buffer_unmap(buffer, &map);
    gst_sample_unref(sample);

    return GST_FLOW_OK;
}

int rtsp_main(int argc, char *argv[]) {
    GstElement *pipeline, *source, *demuxer, *video_decoder, *video_rate, *jpeg_encoder, *appsink;
    GstBus *bus;
    GstMessage *msg;
    GstStateChangeReturn ret;

    if (argc < 3) {
        g_printerr("Usage: %s <rtsp_url> <frame_rate>\n", argv[0]);
        return -1;
    }

    int frame_rate = atoi(argv[2]);
    if (frame_rate <= 0) {
        g_printerr("Invalid frame rate: %d. Please provide a positive integer.\n", frame_rate);
        return -1;
    }

    gst_init(&argc, &argv);

    source = gst_element_factory_make("rtspsrc", "source");
    g_object_set(source, "location", argv[1], NULL); 

    demuxer = gst_element_factory_make("rtph264depay", "demuxer");
    video_decoder = gst_element_factory_make("avdec_h264", "video_decoder");
    video_rate = gst_element_factory_make("videorate", "video_rate");
    jpeg_encoder = gst_element_factory_make("jpegenc", "jpeg_encoder");
    appsink = gst_element_factory_make("appsink", "appsink");

    pipeline = gst_pipeline_new("video-pipeline");

    if (!pipeline || !source || !demuxer || !video_decoder || !video_rate || !jpeg_encoder || !appsink) {
        g_printerr("Not all elements could be created.\n");
        return -1;
    }

    g_object_set(video_rate, "max-rate", frame_rate, NULL);

    g_object_set(appsink, "emit-signals", TRUE, "sync", FALSE, NULL);

    g_signal_connect(appsink, "new-sample", G_CALLBACK(on_new_sample), NULL);

    gst_bin_add_many(GST_BIN(pipeline), source, demuxer, video_decoder, video_rate, jpeg_encoder, appsink, NULL);

    g_signal_connect(source, "pad-added", G_CALLBACK(on_pad_added), demuxer);
    gst_element_link(demuxer, video_decoder);
    gst_element_link(video_decoder, video_rate);
    gst_element_link(video_rate, jpeg_encoder);
    gst_element_link(jpeg_encoder, appsink);

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
    return gst_macos_main((GstMainFunc) rtsp_main, argc, argv, NULL);
#else
    return rtsp_main(argc, argv);
#endif
}

