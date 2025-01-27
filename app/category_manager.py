import os

CATEGORY_FILE = "categories.txt"

class CategoryManager:
    categories = []
    category_counter = 1  # Start category IDs from 1

    @classmethod
    def load_categories(cls):
        """Load categories from the categories.txt file."""
        from models import Category
        Category._loading = True  # Set loading state
        cls.categories.clear()  # Clear existing categories
        if os.path.exists(CATEGORY_FILE):
            with open(CATEGORY_FILE, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:  # Check if the line is not empty
                        category_id, category_name = line.split(',')
                        category = Category(
                            category_id=int(category_id),  # Set category_id
                            category_name=category_name
                        )
                        cls.categories.append(category)
                        cls.category_counter = max(cls.category_counter, category.category_id + 1)  # Update counter
        Category._loading = False  # Reset loading state

    @classmethod
    def add_category(cls, category):
        if cls.category_exists(category.category_name):
            return f"Category '{category.category_name}' already exists. Cannot add duplicate."
        else:
            # Assign the next available category ID
            category.category_id = cls.get_next_category_id()  
            cls.categories.append(category)
            cls.increment_category_counter()  # Increment the counter for the next category
            cls.save_category(category)  # Save the new category to the file
            return f"Category '{category.category_name}' created successfully."

    @classmethod
    def save_category(cls, category):
        """Save the category to the categories.txt file."""
        with open(CATEGORY_FILE, 'a') as f:
            f.write(f"{category.category_id},{category.category_name}\n")

    @classmethod
    def get_all_category_names(cls):
        return [category.category_name for category in cls.categories]

    @classmethod
    def category_exists(cls, category_name):
        """Check if a category exists."""
        return any(category.category_name == category_name for category in cls.categories)

    @classmethod
    def get_all_categories(cls):
        return cls.categories  # Return all categories if needed

    @classmethod
    def get_all_category_ids(cls):
        """Retrieve all category IDs."""
        return [category.category_id for category in cls.categories]

    @classmethod
    def check_category_exists(cls, category_id):
        """Check if a category exists."""
        return any(category.category_id == category_id for category in cls.categories)

    @classmethod
    def get_next_category_id(cls):
        return cls.category_counter

    @classmethod
    def increment_category_counter(cls):
        cls.category_counter += 1

