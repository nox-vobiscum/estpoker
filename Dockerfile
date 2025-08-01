# syntax=docker/dockerfile:1
FROM maven:3.9.6-eclipse-temurin-21 AS build

WORKDIR /app

# Nur Dependencies laden (beschleunigt Builds)
COPY .mvn/ .mvn/
COPY mvnw .
COPY pom.xml .

# mvnw ausführbar machen (wichtig bei Windows-Hosts!)
RUN chmod +x ./mvnw && ./mvnw dependency:go-offline

# Jetzt Quellcode kopieren
COPY src ./src

# App bauen
RUN ./mvnw package -DskipTests

# --- RUNTIME STAGE ---
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
