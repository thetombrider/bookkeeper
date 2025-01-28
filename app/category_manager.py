import os
from config import CATEGORIES_FILE
from utils.csv_handler import read_csv, write_csv, write_csv_all, initialize_csv_file
from models import Category

CATEGORY_FIELDS = ['category_id', 'category_name']

class CategoryManager:
    categories = []
    category_counter = 1

    @classmethod
    def load_categories(cls):
        """Load categories from CSV file."""
        initialize_csv_file(CATEGORIES_FILE, CATEGORY_FIELDS)
        
        cls.categories.clear()
        categories = read_csv(CATEGORIES_FILE)
        
        # Debug: Print the raw data read from the CSV
        print("Raw categories data:", categories)
        
        if categories:
            cls.category_counter = max(int(c.get('category_id', 0)) for c in categories) + 1

        Category._loading = True
        for row in categories:
            try:
                category = Category(
                    category_id=int(row.get('category_id', 0)),
                    category_name=row.get('category_name', '')
                )
                cls.categories.append(category)
            except ValueError as e:
                print(f"Skipping invalid category: {e}")
        Category._loading = False

    @classmethod
    def is_valid_category_id(cls, category_id):
        """Check if a category ID is valid."""
        return any(category.category_id == category_id for category in cls.categories)

    @classmethod
    def save_category(cls, category):
        """Save a single category to CSV file."""
        category_data = {
            'category_id': category.category_id,
            'category_name': category.category_name
        }
        write_csv(CATEGORIES_FILE, category_data, CATEGORY_FIELDS)

    @classmethod
    def add_category(cls, category):
        if cls.category_exists(category.category_name):
            return f"Category '{category.category_name}' already exists. Cannot add duplicate."
        
        category.category_id = cls.get_next_category_id()
        cls.categories.append(category)
        cls.increment_category_counter()
        cls.save_category(category)
        return f"Category '{category.category_name}' created successfully."

    @classmethod
    def category_exists(cls, category_name):
        """Check if a category exists."""
        return any(category.category_name == category_name for category in cls.categories)

    @classmethod
    def get_all_categories(cls):
        return cls.categories

    @classmethod
    def get_all_category_ids(cls):
        """Retrieve all category IDs."""
        return [category.category_id for category in cls.categories]

    @classmethod
    def get_next_category_id(cls):
        return cls.category_counter

    @classmethod
    def increment_category_counter(cls):
        cls.category_counter += 1

