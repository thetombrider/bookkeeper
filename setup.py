from setuptools import setup, find_packages

setup(
    name='bookkeeper',
    version='0.1',
    packages=find_packages(),
    install_requires=[
        'pydantic',
        'click',
    ],
    entry_points={
        'console_scripts': [
            'bookkeeper=bookkeeper.main:cli',  # Adjusted to include the package name
        ],
    },
)
