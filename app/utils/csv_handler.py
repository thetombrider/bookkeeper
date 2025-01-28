import csv
import os
from typing import List, Dict, Any

def initialize_csv_file(file_path: str, fieldnames: List[str]) -> None:
    """Initialize a CSV file with headers if it doesn't exist."""
    if not os.path.exists(file_path):
        with open(file_path, mode='w', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()

def read_csv(file_path: str) -> List[Dict[str, Any]]:
    """Read data from a CSV file and return as a list of dictionaries."""
    if not os.path.exists(file_path):
        print(f"File does not exist: {file_path}")
        return []
    
    with open(file_path, mode='r', newline='') as file:
        reader = csv.DictReader(file)
        data = list(reader)
        
        # Debug: Print the file path and the data read
        print(f"Reading from file: {file_path}")
        print("Data read from CSV:", data)
        
        return data

def write_csv(file_path: str, data: Dict[str, Any], fieldnames: List[str]) -> None:
    """Write a single row to a CSV file."""
    file_exists = os.path.exists(file_path)
    
    with open(file_path, mode='a', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        
        if not file_exists:
            writer.writeheader()
        
        writer.writerow(data)

def write_csv_all(file_path: str, data: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    """Write multiple rows to a CSV file, overwriting existing content."""
    with open(file_path, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
