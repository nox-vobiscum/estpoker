# ---------- Build Stage ----------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Kopiere nur was nötig ist – zuerst die Konfiguration und Maven-Wrapper
COPY .mvn/ .mvn/
COPY mvnw .
COPY pom.xml .

# Preload dependencies (bessere Caching-Effizienz)
RUN ./mvnw dependency:go-offline

# Dann restlicher Source
COPY src ./src

# Erstelle das Paket ohne Tests
RUN ./mvnw clean package -DskipTests=true

# ---------- Runtime Stage ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Kopiere JAR vom vorherigen Build
COPY --from=build /app/target/estpoker-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
