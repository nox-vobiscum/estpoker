# ---------- Build Stage ----------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Kopiere Maven-Wrapper und Konfiguration
COPY .mvn/ .mvn/
COPY mvnw .
COPY pom.xml .

# Lade Abhängigkeiten (optimiert fürs Caching)
RUN ./mvnw dependency:go-offline

# Kopiere restlichen Code
COPY src ./src

# Baue Projekt, ohne Tests zu kompilieren oder auszuführen
RUN ./mvnw clean package -Dmaven.test.skip=true

# ---------- Runtime Stage ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Kopiere fertiges JAR vom Build-Container
COPY --from=build /app/target/estpoker-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
