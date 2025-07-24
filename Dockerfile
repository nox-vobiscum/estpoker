# Use official OpenJDK 21 image with Maven
FROM maven:3.9.6-eclipse-temurin-21 as build

# Create app directory
WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy source code and build app
COPY src ./src
RUN mvn package -DskipTests

# Use lightweight JRE for final image
FROM eclipse-temurin:21-jre-alpine

# Copy built jar from previous stage
COPY --from=build /app/target/estpoker-0.0.1-SNAPSHOT.jar app.jar

# Run app on port 8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
