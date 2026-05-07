# AgentFlow

## Project Structure

- `backend/` - FastAPI backend application
    - `app/` - Main application code
        - `agents/` - Agent logic and utilities
        - `api/` - API routes
        - `config/` - Configuration files
        - `repository/` - Data access and repositories
        - `services/` - Service layer
        - `utils/` - Utility functions
        - `workers/` - Background workers and notification handlers
    - `requirements.txt` - Python dependencies

- `frontend/` - React frontend application
    - `src/` - Source code
        - `api/` - API utilities
        - `app/` - App entry and providers
        - `components/` - UI components
        - `features/` - Feature modules
        - `lib/` - Shared libraries
        - `styles/` - Global styles
        - `types/` - TypeScript types
    - `public/` - Static files
    - `package.json` - Node dependencies

## Running the Application Locally

### Backend
1. Navigate to the `backend/` directory:
	```sh
	cd backend
	```
2. Install Python dependencies:
	```sh
	pip install -r requirements.txt
	```
3. Run the FastAPI server:
	```sh
	uvicorn app.main:app --reload
	```

### Frontend
1. Navigate to the `frontend/` directory:
	```sh
	cd frontend
	```
2. Install Node dependencies:
	```sh
	npm install
	```
3. Start the development server:
	```sh
	npm start
	```
