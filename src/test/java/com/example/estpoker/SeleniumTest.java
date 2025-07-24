package com.example.estpoker;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;

import java.time.Duration;

public class SeleniumTest {

    private WebDriver hostDriver;
    private WebDriver participantDriver;

    @BeforeEach
    public void setup() {
        WebDriverManager.chromedriver().setup();

        hostDriver = new ChromeDriver();
        participantDriver = new ChromeDriver();

        hostDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
        participantDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
    }

    @AfterEach
    public void teardown() {
        try {
            Thread.sleep(5000);  // Testfenster 5 Sekunden offen halten
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        if (hostDriver != null) hostDriver.quit();
        if (participantDriver != null) participantDriver.quit();
    }

    @Test
    public void fullPokerFlow() throws InterruptedException {
        String roomCode = "test123";
        String hostName = "Hosty";
        String participantName = "Parti";

        // Host betritt Raum
        hostDriver.get("http://localhost:8080/room?roomCode=" + roomCode + "&participantName=" + hostName);
        Thread.sleep(1000);

        // Teilnehmer betritt selben Raum
        participantDriver.get("http://localhost:8080/room?roomCode=" + roomCode + "&participantName=" + participantName);
        Thread.sleep(1000);

        // Host wählt Karte 3
        WebElement hostCard3 = hostDriver.findElement(By.xpath("//button[text()='3']"));
        hostCard3.click();
        Thread.sleep(1000);

        // Teilnehmer wählt Karte 5
        WebElement participantCard5 = participantDriver.findElement(By.xpath("//button[text()='5']"));
        participantCard5.click();
        Thread.sleep(1000);

        // Host klickt auf "Karten aufdecken"
        WebElement revealButton = hostDriver.findElement(By.xpath("//button[contains(text(),'aufdecken')]"));
        revealButton.click();
        Thread.sleep(2000);

        // Durchschnitt auslesen
        WebElement averageElement = hostDriver.findElement(By.xpath("//*[contains(text(),'⌀ Durchschnitt')]/following-sibling::span"));
        String avgText = averageElement.getText();
        System.out.println("▶ Durchschnitt angezeigt: " + avgText);

        // Formatierung bereinigen (z. B. "4,0" → "4.0")
        String normalized = avgText.replace(",", ".").replaceAll("[^0-9.]", "");

        try {
            double avg = Double.parseDouble(normalized);
            Assertions.assertEquals(4.0, avg, 0.1, "Durchschnitt sollte ca. 4.0 sein");
        } catch (NumberFormatException e) {
            Assertions.fail("Kein gültiger Durchschnittswert gefunden: " + avgText);
        }
    }
}
