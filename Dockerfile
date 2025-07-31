# ---------- Build Stage ----------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Maven-Wrapper und Konfig laden
COPY .mvn/ .mvn/
COPY mvnw .
COPY pom.xml .

# Abhängigkeiten vorausladen (für Caching)
RUN ./mvnw dependency:go-offline

# Source-Code erst nach go-offline kopieren
COPY src ./src

# Tests KOMPLETT überspringen (inkl. Kompilierung)
RUN ./mvnw clean package -Dmaven.test.skip=true

# ---------- Runtime Stage ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /app/target/estpoker-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
