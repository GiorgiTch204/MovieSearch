## Installation and Project Setup

Before running the application, it is recommended to create and activate a virtual environment in order to isolate the project dependencies from the global Python environment.

### 1. Activate the Virtual Environment

On Windows, activate the virtual environment using the following command:

venv\Scripts\activate

After successful activation, the terminal prompt should display the environment name, for example:

### 2. Install Project Dependencies

If the required libraries have not been installed yet, install them using the requirements.txt file:

python -m pip install -r backend/requirements.txt

This command installs all dependencies necessary for running the backend application.

### 3. Run the FastAPI Development Server

To start the backend server, run the following command:

uvicorn main:app --reload

The --reload option enables automatic server reloading whenever changes are made to the source code, which is useful during development.

Once the server is running, the API documentation can be accessed at:

http://127.0.0.1:8000/docs
