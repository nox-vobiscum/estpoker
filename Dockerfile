# Basis-Image mit Java 21
FROM eclipse-temurin:21-jdk

# Arbeitsverzeichnis im Container
WORKDIR /app

# Das JAR-File kopieren (Pfad zur .jar-Datei im target-Verzeichnis)
COPY target/estpoker-0.0.1-SNAPSHOT.jar app.jar

# Aktiviere das Spring Boot Profil "prod"
ENV SPRING_PROFILES_ACTIVE=prod

# Startbefehl
ENTRYPOINT ["java", "-jar", "app.jar"]
