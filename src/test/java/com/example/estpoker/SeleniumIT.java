package com.example.estpoker;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.TestPropertySource;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "spring.main.allow-bean-definition-overriding=true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class SeleniumIT {

    @LocalServerPort
    private int port;

    private WebDriver hostDriver;
    private WebDriver participantDriver;

    @BeforeAll
    public void setupClass() {
        WebDriverManager.chromedriver().setup();
    }

    @BeforeEach
    public void setup() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--incognito");
        options.addArguments("--disable-application-cache");

        hostDriver = new ChromeDriver(options);
        participantDriver = new ChromeDriver(options);

        hostDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
        participantDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
    }

    @AfterEach
    public void teardown() {
        if (hostDriver != null) hostDriver.quit();
        if (participantDriver != null) participantDriver.quit();
    }

    @Test
    public void fullPokerFlow() throws InterruptedException {
        String roomCode = "test123";
        String hostName = "Hosty";
        String participantName = "Parti";

        String baseUrl = "http://localhost:" + port;

        hostDriver.get(baseUrl + "/room?roomCode=" + roomCode + "&participantName=" + hostName);
        participantDriver.get(baseUrl + "/room?roomCode=" + roomCode + "&participantName=" + participantName);

        Thread.sleep(1000); // Warte, bis Seite und WebSocket vollständig geladen

        hostDriver.findElement(By.xpath("//button[text()='3']")).click();
        participantDriver.findElement(By.xpath("//button[text()='5']")).click();

        Thread.sleep(500); // Zeit geben, um Votes zu verarbeiten

        hostDriver.findElement(By.xpath("//button[contains(text(),'aufdecken')]")).click();

        new WebDriverWait(hostDriver, Duration.ofSeconds(5))
                .until(driver -> driver.findElement(By.id("averageVote")));

        String avgText = hostDriver.findElement(By.id("averageVote")).getText();
        System.out.println("▶ Durchschnitt angezeigt: " + avgText);

        String normalized = avgText.replace(",", ".").replaceAll("[^0-9.]", "");
        try {
            double avg = Double.parseDouble(normalized);
            assertEquals(4.0, avg, 0.1, "Durchschnitt sollte ca. 4.0 sein");
        } catch (NumberFormatException e) {
            fail("Kein gültiger Durchschnittswert gefunden: " + avgText);
        }
    }
}
