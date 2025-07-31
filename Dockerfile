# ---------- Build Stage ----------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Maven Wrapper & Projekt-Metadaten kopieren
COPY .mvn/ .mvn/
COPY mvnw .
COPY pom.xml .

# Nur Abhängigkeiten laden (schnellerer Build bei Quellcode-Änderungen)
RUN ./mvnw dependency:go-offline

# Projektquellcode kopieren
COPY src ./src

# Build ohne Tests (werden nicht ausgeführt & nicht kompiliert)
RUN ./mvnw clean package -Dmaven.test.skip=true


# ---------- Runtime Stage ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Nur das fertige JAR in das Runtime-Image übernehmen
COPY --from=build /app/target/estpoker-0.0.1-SNAPSHOT.jar app.jar

# HTTP-Port freigeben
EXPOSE 8080

# Startbefehl
ENTRYPOINT ["java", "-jar", "app.jar"]
