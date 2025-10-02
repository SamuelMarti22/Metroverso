# Metroverso

"The Metro system is the main public transportation network in the city of Medellín. However, many of its users face difficulties in moving efficiently, especially when they are far from the system’s main lines. This situation is largely due to a lack of knowledge about the routes, stations, and complementary services such as feeder buses, integrated buses, and trams, which leads to delays, frustration, and obstacles in reaching their destinations.

In order to improve mobility and the user experience, this project proposes the development of a web application that, based on the user's location, identifies the nearest stations and builds an optimal route to help them reach their destination using the different components of the Metro system."


## Step-by-step guide to run the Metroverso project

### 1. Download the repository

1. Go to the project's GitHub page.
2. Click the "Code" button and select "Download ZIP".
3. Extract the ZIP file to your preferred folder.

### 2. Open the project in VS Code

1. Open Visual Studio Code.
2. Select "File" > "Open Folder" and choose the folder where you extracted the project.

### 3. Install dependencies

1. Open a terminal in VS Code (you can use PowerShell).
2. Run the following command to install the dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

### 4. Migrate the database

1. Run the following commands to create the necessary tables:

   ```powershell
   python manage.py makemigrations
   python manage.py migrate
   ```

### 5. Load test data

1. Run the following commands to populate the database with sample data:

   ```powershell
   python manage.py loaddata metroversoApp/fixtures/superuser.json
   python manage.py loaddata metroversoApp/fixtures/users.json
   python manage.py loaddata metroversoApp/fixtures/stations.json
   python manage.py loaddata metroversoApp/fixtures/packages.json
   python manage.py loaddata metroversoApp/fixtures/routes.json
   python manage.py loaddata metroversoApp/fixtures/blogposts.json
   python manage.py loaddata metroversoApp/fixtures/pointsofinterest.json
   python manage.py loaddata metroversoApp/fixtures/stationservices.json
   ```

### 6. Run the development server

1. Start the server with the following command:

   ```powershell
   python manage.py runserver
   ```

2. Open your browser and go to:

   ```
   http://localhost:8000/
   ```

   You should now see the Metroverso application running.

### 7. Admin panel access

1. If you need to access the Django admin panel, create a superuser:

   ```powershell
   python manage.py createsuperuser
   ```

2. Go to:

   ```
   http://localhost:8000/admin/
   ```

   Log in with the superuser credentials you created.



