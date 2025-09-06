# Metroverso

"The Metro system is the main public transportation network in the city of Medellín. However, many of its users face difficulties in moving efficiently, especially when they are far from the system’s main lines. This situation is largely due to a lack of knowledge about the routes, stations, and complementary services such as feeder buses, integrated buses, and trams, which leads to delays, frustration, and obstacles in reaching their destinations.

In order to improve mobility and the user experience, this project proposes the development of a web application that, based on the user's location, identifies the nearest stations and builds an optimal route to help them reach their destination using the different components of the Metro system."

## How to migrate the database

1. Open a terminal in the project root directory.
2. Run the following commands:

   ```powershell
   python manage.py makemigrations
   python manage.py migrate
   ```

   This will create all necessary tables in the database.

## How to load test data

To load the sample data into the database, run:

```powershell
python manage.py loaddata metroversoApp/fixtures/users.json
python manage.py loaddata metroversoApp/fixtures/stations.json
python manage.py loaddata metroversoApp/fixtures/packages.json
python manage.py loaddata metroversoApp/fixtures/routes.json
```

This will populate the database with test data for development and testing.

## How to run the project

1. Make sure you have all dependencies installed. You can install them with:

   ```powershell
   pip install -r requirements.txt
   ```

2. Start the development server:

   ```powershell
   python manage.py runserver
   ```

3. Open your browser and go to:

   ```
   http://localhost:8000/
   ```

   You should now see the Metroverso application running.

## Admin access

To access the Django admin panel:

1. Create a superuser (if you haven't already):

   ```powershell
   python manage.py createsuperuser
   ```

2. Go to:

   ```
   http://localhost:8000/admin/
   ```

   Log in with your superuser credentials.



