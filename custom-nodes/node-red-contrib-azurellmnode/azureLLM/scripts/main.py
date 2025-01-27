import os
import re
import sys
from dotenv import load_dotenv
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SimpleField,
    SearchableField,
    SearchFieldDataType,
)
from azure.ai.formrecognizer import DocumentAnalysisClient
from openai import AzureOpenAI
import argparse
import json

load_dotenv()

def parse_arguments():
    parser = argparse.ArgumentParser(description='Azure LLM')
    parser.add_argument('--filePath', type=str, help='Path to the document')
    return parser.parse_args()

class DocumentQA:
    def __init__(self):
        
        sys.stdout.write(json.dumps({"status": "initializing"}))
        sys.stdout.flush()

        # Initialize Azure clients
        self.doc_client = DocumentAnalysisClient(
            endpoint=os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"),
            credential=AzureKeyCredential(os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY"))
        )
        
        self.search_client = None
        self.index_client = SearchIndexClient(
            endpoint=os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT"),
            credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_KEY"))
        )
        
        self.openai_client = AzureOpenAI(
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_key=os.getenv("AZURE_OPENAI_KEY"),
            api_version="2024-02-15-preview"
        )

    def create_valid_id(self, filename):
        """Create a valid document ID from filename by removing invalid characters"""
        base_name = os.path.splitext(filename)[0]
        valid_id = re.sub(r'[^a-zA-Z0-9_\-=]', '-', base_name)
        return valid_id

    def process_document(self, file_path):
        """Process document using Azure Document Intelligence"""
        sys.stdout.write(json.dumps({"status": "processing_document", "file": file_path}))
        sys.stdout.flush()
        
        with open(file_path, "rb") as f:
            poller = self.doc_client.begin_analyze_document("prebuilt-document", f)
        result = poller.result()
        
        sys.stdout.write(json.dumps({"status": "document_processed", "file": file_path}))
        sys.stdout.flush()
        
        return " ".join([p.content for p in result.paragraphs])

    def create_search_index(self, index_name="documents"):
        """Create or update search index"""
        sys.stdout.write(json.dumps({"status": "creating_search_index", "index_name": index_name}))
        sys.stdout.flush()
        
        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True),
            SearchableField(name="content", type=SearchFieldDataType.String),
            SimpleField(name="original_filename", type=SearchFieldDataType.String)
        ]
        index = SearchIndex(name=index_name, fields=fields)
        self.index_client.create_or_update_index(index)
        
        # Initialize the search client
        self.search_client = SearchClient(
            endpoint=os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT"),
            credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_KEY")),
            index_name=index_name
        )
        
        sys.stdout.write(json.dumps({"status": "search_index_created", "index_name": index_name}))
        sys.stdout.flush()

    def index_document(self, content, filename):
        """Index document content with valid ID"""
        doc_id = self.create_valid_id(filename)
        
        sys.stdout.write(json.dumps({
            "status": "indexing_document", 
            "filename": filename, 
            "doc_id": doc_id
        }))
        sys.stdout.flush()
        
        document = {
            "id": doc_id,
            "content": content,
            "original_filename": filename
        }
        try:
            self.search_client.upload_documents([document])
            
            sys.stdout.write(json.dumps({
                "status": "document_indexed", 
                "filename": filename
            }))
            sys.stdout.flush()
        except Exception as e:
            error_msg = json.dumps({
                "status": "indexing_error", 
                "filename": filename, 
                "error": str(e)
            })
            sys.stdout.write(error_msg)
            sys.stdout.flush()
            raise

    def process_all_documents(self, args):
        """Process a single document at the specified file path"""
        file_path = args.filePath

        if not file_path:
            sys.stdout.write(json.dumps({"status": "no_file_path"}))
            sys.stdout.flush()
            return

        self.create_search_index()
        
        if file_path.lower().endswith(('.pdf', '.docx')):
            try:
                content = self.process_document(file_path)
                filename = os.path.basename(file_path)
                self.index_document(content, filename)
                
                sys.stdout.write(json.dumps({
                    "status": "document_processing_complete", 
                    "filename": filename
                }))
                sys.stdout.flush()
            except Exception as e:
                error_msg = json.dumps({
                    "status": "processing_error", 
                    "file": file_path, 
                    "error": str(e)
                })
                sys.stdout.write(error_msg)
                sys.stdout.flush()
                raise
        else:
            unsupported_msg = json.dumps({
                "status": "unsupported_file_type", 
                "file": file_path
            })
            sys.stdout.write(unsupported_msg)
            sys.stdout.flush()

    def search_documents(self, query):
        """Search for relevant content"""
        results = self.search_client.search(query)
        return [doc["content"] for doc in results]

    def generate_answer(self, query, contexts):
        """Generate answer using Azure OpenAI"""
        deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
        if not deployment_name:
            raise ValueError("AZURE_OPENAI_DEPLOYMENT_NAME not set in .env file")

        prompt = f"""Based on the following context, answer the question.
        Context: {' '.join(contexts[:3])}
        Question: {query}
        Answer:"""
        # print("deployment_name", {deployment_name})
        try:
            response = self.openai_client.chat.completions.create(
                model=deployment_name,  # Use the deployment name instead of model name
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=150
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error generating answer: {str(e)}")
            return "Sorry, I encountered an error while generating the answer. Please check your Azure OpenAI deployment configuration."

    def ask_question(self, question):
        """Ask a question about the processed documents"""
        contexts = self.search_documents(question)
        if not contexts:
            return "No relevant information found in the documents."
        return self.generate_answer(question, contexts)

def main(args):
    qa_system = DocumentQA()
    
    qa_system.process_all_documents(args)

    while True:
        try:
            input_data = sys.stdin.readline().strip()
            if not input_data:
                break  

            if input_data.lower() == "exit": 
                print("Exiting...", file=sys.stderr)
                break
            try:
                data = json.loads(input_data)
                input_question = data.get('prompt', "")
            except json.JSONDecodeError:
                input_question = input_data 
            
            if input_question:
                answer = qa_system.ask_question(input_question)
                sys.stdout.write(json.dumps({
                    "status": "model_response", 
                    "prompt": input_question,
                    "response": answer
                }))
                sys.stdout.flush()
            else:
                print("No 'prompt' field in JSON input or empty input.", file=sys.stderr)

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.stderr.flush()

if __name__ == "__main__":
    args = parse_arguments()
    main(args)
 