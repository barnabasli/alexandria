#!/usr/bin/env python3

import os
import sys
from typing import List, Dict, Set
from sqlalchemy.orm import Session
from database import SessionLocal, Paper
from pinecone_service import PineconeService
from supabase_storage import SupabaseStorageService
from dotenv import load_dotenv

load_dotenv()

class DatabaseSync:
    def __init__(self):
        self.pinecone_service = PineconeService()
        self.storage_service = SupabaseStorageService()
        self.db = SessionLocal()
    
    def get_supabase_papers(self) -> Dict[str, Paper]:
        papers = self.db.query(Paper).all()
        return {str(paper.id): paper for paper in papers}
    
    def get_pinecone_papers(self) -> Set[str]:
        try:
            results = self.pinecone_service.index.query(
                vector=[0.0] * 1536,
                top_k=10000,
                include_metadata=True
            )
            paper_ids = set()
            try:
                matches = results.matches
                for match in matches:
                    paper_id = match.metadata.get("paper_id")
                    if paper_id:
                        paper_ids.add(paper_id)
            except AttributeError:
                if isinstance(results, dict) and 'matches' in results:
                    for match in results['matches']:
                        paper_id = match.get('metadata', {}).get('paper_id')
                        if paper_id:
                            paper_ids.add(paper_id)
            return paper_ids
        except Exception as e:
            print(f"Error getting Pinecone papers: {e}")
            return set()
    
    def sync_databases(self, dry_run: bool = True) -> Dict[str, List[str]]:
        print("Starting database sync...")

        supabase_papers = self.get_supabase_papers()
        pinecone_papers = self.get_pinecone_papers()

        print(f"Found {len(supabase_papers)} papers in Supabase")
        print(f"Found {len(pinecone_papers)} papers in Pinecone")

        supabase_ids = set(supabase_papers.keys())
        pinecone_ids = pinecone_papers

        only_in_supabase = supabase_ids - pinecone_ids
        only_in_pinecone = pinecone_ids - supabase_ids

        print("Analysis Results:")
        print(f"  Orphaned in Supabase (deleting): {len(only_in_supabase)}")
        print(f"  Orphaned in Pinecone (deleting): {len(only_in_pinecone)}")

        if only_in_supabase:
            for paper_id in only_in_supabase:
                paper = supabase_papers[paper_id]
                print(f"  Deleting from Supabase: {paper.title} (ID: {paper_id})")
                if not dry_run:
                    file_url = str(paper.file_url) if paper.file_url else None
                    if file_url and file_url.strip():
                        try:
                            self.storage_service.delete_pdf(file_url)
                        except Exception as e:
                            print(f"    Error deleting from storage: {e}")
                    self.db.delete(paper)

        if only_in_pinecone:
            for paper_id in only_in_pinecone:
                print(f"  Deleting from Pinecone: {paper_id}")
                if not dry_run:
                    self.pinecone_service.delete_document_vectors(paper_id)

        if not dry_run:
            self.db.commit()
            print("Sync cleanup committed")

        return {
            "deleted_from_supabase": list(only_in_supabase),
            "deleted_from_pinecone": list(only_in_pinecone)
        }
    
    def clear_all_data(self, dry_run: bool = True) -> bool:
        print("Clearing all data...")
        
        if dry_run:
            print("(DRY RUN - No data will be deleted)")
        
        try:
            print("Clearing Pinecone index...")
            if not dry_run:
                results = self.pinecone_service.index.query(
                    vector=[0.0] * 1536,
                    top_k=10000,
                    include_metadata=False
                )
                try:
                    matches = results.matches
                    if matches:
                        vector_ids = [match.id for match in matches]
                        self.pinecone_service.index.delete(ids=vector_ids)
                        print(f"  Deleted {len(vector_ids)} vectors from Pinecone")
                except AttributeError:
                    if isinstance(results, dict) and 'matches' in results:
                        vector_ids = [match.get('id') for match in results['matches']]
                        if vector_ids:
                            self.pinecone_service.index.delete(ids=vector_ids)
                            print(f"  Deleted {len(vector_ids)} vectors from Pinecone")
            
            print("Clearing Supabase database...")
            if not dry_run:
                papers = self.db.query(Paper).all()
                for paper in papers:
                    file_url = str(paper.file_url) if paper.file_url else None
                    if file_url and file_url.strip():
                        try:
                            self.storage_service.delete_pdf(file_url)
                        except Exception as e:
                            print(f"  Error deleting from storage: {e}")
                    self.db.delete(paper)
                self.db.commit()
                print(f"  Deleted {len(papers)} papers from database")
            
            print("All data cleared successfully")
            return True
            
        except Exception as e:
            print(f"Error clearing data: {e}")
            return False
    
    def close(self):
        self.db.close()

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Sync Pinecone and Supabase databases")
    parser.add_argument("--dry-run", action="store_true", default=True,
                       help="Show what would be done without making changes (default: True)")
    parser.add_argument("--execute", action="store_true",
                       help="Actually perform the sync operations")
    parser.add_argument("--clear-all", action="store_true",
                       help="Clear all data from both databases")
    
    args = parser.parse_args()
    
    if args.execute:
        args.dry_run = False
    
    sync = DatabaseSync()
    
    try:
        if args.clear_all:
            print("WARNING: This will delete ALL data from both Pinecone and Supabase")
            if not args.dry_run:
                confirm = input("Are you sure you want to continue? (yes/no): ")
                if confirm.lower() != 'yes':
                    print("Operation cancelled.")
                    return
            success = sync.clear_all_data(dry_run=args.dry_run)
            if success:
                print("All data cleared successfully")
            else:
                print("Failed to clear all data")
        else:
            results = sync.sync_databases(dry_run=args.dry_run)
            if args.dry_run:
                print("To execute these changes, run with --execute flag")
            else:
                print("Sync completed")
    finally:
        sync.close()

if __name__ == "__main__":
    main()