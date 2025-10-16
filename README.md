# Metroverso

**Interactive Metro System Web Application for Medellín**

The Metro system is the main public transportation network in the city of Medellín. However, many users face difficulties moving efficiently, especially when they are far from the system's main lines. This situation is largely due to a lack of knowledge about routes, stations, and complementary services such as feeder buses, integrated buses, and trams.

**Metroverso** is a web application that identifies the nearest metro stations based on the user's location and builds optimal routes to help them reach their destinations using the different components of the Metro system. The application features an interactive map with station information, services, and points of interest.

## Features

- **Interactive Map**: Real-time map with station markers and route visualization
- **Station Information**: Detailed popups showing available services and nearby points of interest
- **User Authentication**: Complete login/register system with user profiles
- **Route Planning**: Optimal route calculation between stations
- **Multi-language Support**: English and Spanish localization
- **Responsive Design**: Works on desktop and mobile devices

## Technologies Used

- **Backend**: Django 5.2.4, SQLite
- **Frontend**: Bootstrap 5.1.3, Mapbox GL JS v3.3.0
- **Authentication**: Django's built-in auth system
- **Internationalization**: Django i18n framework

## Prerequisites

Before setting up the project, make sure you have the following installed:

- **Python 3.8+** ([Download Python](https://www.python.org/downloads/))
- **VS Code** (recommended) ([Download VS Code](https://code.visualstudio.com/))
- **Git** (optional, only needed for Option 2) ([Download Git](https://git-scm.com/downloads))


## Installation Guide

### Option 1: Download ZIP (Recommended)

1. Go to the [GitHub repository](https://github.com/SamuelMarti22/Metroverso)
2. Click the green **"Code"** button and select **"Download ZIP"**
3. Extract the ZIP file to your preferred folder (e.g., `C:\Users\YourName\Documents\` or `~/Documents/`)
4. Open the extracted folder in VS Code or your preferred editor

#### Windows (PowerShell/Command Prompt):
```powershell
# Navigate to the extracted folder
cd "C:\path\to\extracted\Metroverso-main"

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### Linux/macOS (Terminal):
```bash
# Navigate to the extracted folder
cd ~/path/to/extracted/Metroverso-main

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Option 2: Clone the Repository (For Developers)

#### Windows (PowerShell/Command Prompt):
```powershell
# Clone the repository
git clone https://github.com/SamuelMarti22/Metroverso.git
cd Metroverso

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### Linux/macOS (Terminal):
```bash
# Clone the repository
git clone https://github.com/SamuelMarti22/Metroverso.git
cd Metroverso

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Database Setup

### 1. Create and Apply Migrations

#### Windows:
```powershell
# Create new migrations (if needed)
python manage.py makemigrations

# Apply migrations to database
python manage.py migrate
```

#### Linux/macOS:
```bash
# Create new migrations (if needed)
python3 manage.py makemigrations

# Apply migrations to database
python3 manage.py migrate
```

### 2. Load Sample Data

#### Windows:
```powershell
# Load all fixtures in order
python manage.py loaddata metroversoApp/fixtures/users.json
python manage.py loaddata metroversoApp/fixtures/stations.json
python manage.py loaddata metroversoApp/fixtures/packages.json
python manage.py loaddata metroversoApp/fixtures/routes.json
python manage.py loaddata metroversoApp/fixtures/pointsofinterest.json
python manage.py loaddata metroversoApp/fixtures/stationservices.json
```

#### Linux/macOS:
```bash
# Load all fixtures in order
python3 manage.py loaddata metroversoApp/fixtures/users.json
python3 manage.py loaddata metroversoApp/fixtures/stations.json
python3 manage.py loaddata metroversoApp/fixtures/packages.json
python3 manage.py loaddata metroversoApp/fixtures/routes.json
python3 manage.py loaddata metroversoApp/fixtures/pointsofinterest.json
python3 manage.py loaddata metroversoApp/fixtures/stationservices.json
```

## Running the Application

#### Windows:
```powershell
# Start the development server
python manage.py runserver
```

#### Linux/macOS:
```bash
# Start the development server
python3 manage.py runserver
```

Open your browser and navigate to: **http://localhost:8000/**

## Admin Panel Access

To access the Django admin panel:

#### Windows:
```powershell
# Create a superuser account
python manage.py createsuperuser
```

#### Linux/macOS:
```bash
# Create a superuser account
python3 manage.py createsuperuser
```

Then visit: **http://localhost:8000/admin/**

## Troubleshooting

### Database Issues

If you encounter problems with migrations or data loading, you may need to reset the database:

#### Windows:
```powershell
# Remove existing database and migrations
del db.sqlite3
del metroversoApp\migrations\0*.py

# Recreate migrations and database
python manage.py makemigrations metroversoApp
python manage.py migrate

# Reload all data
python manage.py loaddata metroversoApp/fixtures/users.json
python manage.py loaddata metroversoApp/fixtures/stations.json
python manage.py loaddata metroversoApp/fixtures/packages.json
python manage.py loaddata metroversoApp/fixtures/routes.json
python manage.py loaddata metroversoApp/fixtures/pointsofinterest.json
python manage.py loaddata metroversoApp/fixtures/stationservices.json
```

#### Linux/macOS:
```bash
# Remove existing database and migrations
rm db.sqlite3
rm metroversoApp/migrations/0*.py

# Recreate migrations and database
python3 manage.py makemigrations metroversoApp
python3 manage.py migrate

# Reload all data
python3 manage.py loaddata metroversoApp/fixtures/users.json
python3 manage.py loaddata metroversoApp/fixtures/stations.json
python3 manage.py loaddata metroversoApp/fixtures/packages.json
python3 manage.py loaddata metroversoApp/fixtures/routes.json
python3 manage.py loaddata metroversoApp/fixtures/pointsofinterest.json
python3 manage.py loaddata metroversoApp/fixtures/stationservices.json
```

### Common Issues

1. **"Module not found" errors**: Make sure your virtual environment is activated
2. **Permission errors**: On Linux/macOS, you might need to use `sudo` for some commands
3. **Port already in use**: If port 8000 is busy, use: `python manage.py runserver 8080`
4. **Fixture loading fails**: Ensure you load fixtures in the correct order (users → stations → other data)

### Virtual Environment Issues

If you have problems with the virtual environment:

#### Windows:
```powershell
# Deactivate current environment
deactivate

# Remove old environment
rmdir /s venv

# Create new environment
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

#### Linux/macOS:
```bash
# Deactivate current environment
deactivate

# Remove old environment
rm -rf venv

# Create new environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Testing

Run the test suite:

#### Windows:
```powershell
python manage.py test
```

#### Linux/macOS:
```bash
python3 manage.py test
```

## Project Structure

```
Metroverso/
├── metroverso/              # Django project settings
│   ├── settings.py          # Main configuration
│   ├── urls.py              # URL routing
│   └── wsgi.py              # WSGI configuration
├── metroversoApp/           # Main application
│   ├── models.py            # Database models
│   ├── views.py             # View functions
│   ├── static/              # CSS, JS, images
│   ├── templates/           # HTML templates
│   ├── fixtures/            # Sample data
│   └── migrations/          # Database migrations
├── locale/                  # Translation files
├── db.sqlite3              # SQLite database
├── manage.py               # Django management script
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is part of an academic initiative to improve public transportation accessibility in Medellín.

## Note

The route tracking feature is present as a simulation of the user's coordinates. In a real case, the function would be called to take the user's location and pass these coordinates as parameters to the tracking function. However, for testing purposes, we have this simulation. If you want to try it, you must enter a route from Aurora to La Floresta. 

---

**Happy coding!**



