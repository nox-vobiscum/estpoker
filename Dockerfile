# ---------- Build Stage ----------
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Maven Wrapper & pom kopieren
COPY .mvn/ .mvn/
COPY mvnw .
COPY pom.xml .

# Nur Abhängigkeiten laden
RUN ./mvnw dependency:go-offline

# Quellcode kopieren
COPY src ./src

# 💡 TESTS WEDER AUSFÜHREN NOCH KOMPILIEREN!
RUN ./mvnw clean package -Dmaven.test.skip=true


# ---------- Runtime Stage ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /app/target/estpoker-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
