# ---------- Build Stage ----------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Maven Wrapper kopieren
COPY .mvn/ .mvn/
COPY mvnw .
COPY pom.xml .

# Nur Dependencies laden (beschleunigt Builds)
RUN ./mvnw dependency:go-offline

# Jetzt Quellcode kopieren
COPY src ./src

# 💡 Tests werden übersprungen UND nicht kompiliert
RUN ./mvnw clean package -Dmaven.test.skip=true


# ---------- Runtime Stage ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Nur das fertige JAR in das Runtime-Image übernehmen
COPY --from=build /app/target/estpoker-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
