# ---------- Build Stage ----------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Maven-Wrapper und Konfiguration (für Caching)
COPY .mvn/ .mvn/
COPY mvnw .
COPY pom.xml .

# Lade alle Dependencies ohne Source zu kopieren (für Build-Cache)
RUN ./mvnw dependency:go-offline

# Restlicher Source
COPY src ./src

# 💡 Tests vollständig überspringen (keine Kompilierung, keine Abhängigkeiten laden)
RUN ./mvnw clean package -Dmaven.test.skip=true

# ---------- Runtime Stage ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Übernehme JAR aus dem Build-Stage
COPY --from=build /app/target/estpoker-0.0.1-SNAPSHOT.jar app.jar

# Anwendung läuft auf Port 8080
EXPOSE 8080

# Startbefehl
ENTRYPOINT ["java", "-jar", "app.jar"]
