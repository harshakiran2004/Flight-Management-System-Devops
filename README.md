\# Flight Management System



A web-based Flight Management System built using React, Node.js, Express.js, and MongoDB. The application supports flight browsing, user authentication, and flight bookings, with additional weather and aircraft information from external APIs.



\## Technologies Used



\- \*\*Frontend:\*\* React, Vite, JavaScript

\- \*\*Backend:\*\* Node.js, Express.js

\- \*\*Database:\*\* MongoDB

\- \*\*Containerization:\*\* Docker and Docker Compose

\- \*\*External APIs:\*\* Open-Meteo weather data and OpenSky Network aircraft data

\- \*\*Version Control:\*\* Git and GitHub



\## Features



\- User registration and login

\- Flight listing and browsing

\- Flight booking functionality

\- Booking and payment-related data storage

\- Weather information by location

\- Aircraft information by geographic coordinates

\- Docker-based application deployment



\## Prerequisites



Install the following tools:



\- Docker Desktop

\- Git

\- A web browser



Docker Desktop should be running before starting the application.



\## Environment Configuration



Create a `.env` file in the project root using the provided environment example as a reference.



Configure the required values, including `JWT\_SECRET`, before running the application. Use a strong, unique secret and never commit real credentials or secrets to GitHub.



The Docker Compose configuration supplies the MongoDB connection string for the application.



\## Run the Application with Docker Compose



Clone the repository:



```bash

git clone https://github.com/harshakiran2004/Flight-Management-System-Devops.git

cd Flight-Management-System-Devops

```



Start the application:



```bash

docker compose up -d --build

```



Check container status:



```bash

docker compose ps

```



\## Access the Application



\- \*\*Frontend:\*\* http://localhost:3000

\- \*\*Backend:\*\* http://localhost:5000



\## Seed Flight Data



To insert the sample flight data into MongoDB, run:



```bash

docker compose exec backend node backend/seed/seedFlights.js

```



The seed script reports how many flights it seeds.



\## Useful Docker Commands



View service logs:



```bash

docker compose logs

```



View backend logs:



```bash

docker compose logs backend

```



Restart the services:



```bash

docker compose restart

```



Stop the services:



```bash

docker compose down

```



The MongoDB data is stored in a Docker volume. Avoid using `docker compose down -v` unless you intentionally want to remove the volume and its stored data.



\## Project Repository



GitHub: https://github.com/harshakiran2004/Flight-Management-System-Devops



\## Disclaimer



This project is developed for academic and learning purposes. Configure production-grade security, validation, and deployment settings before using it for real bookings or payments.

