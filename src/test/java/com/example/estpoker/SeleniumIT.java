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
import java.util.Arrays;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "spring.main.allow-bean-definition-overriding=true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class SeleniumIT {

    @LocalServerPort
    private int port;

    private WebDriver hostDriver;
    private WebDriver participant1;
    private WebDriver participant2;

    private final List<String> cardPool = Arrays.asList("1", "2", "3", "5", "8", "13", "20", "☕", "?", "📣");
    private final Random random = new Random();

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
        participant1 = new ChromeDriver(options);
        participant2 = new ChromeDriver(options);

        hostDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
        participant1.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
        participant2.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));
    }

    @AfterEach
        public void teardown() {
            try {
            Thread.sleep(5000); // Tabs 5 Sekunden sichtbar lassen
            } catch (InterruptedException e) {
            e.printStackTrace();
        }

    if (hostDriver != null) hostDriver.quit();
    if (participant1 != null) participant1.quit();
    if (participant2 != null) participant2.quit();
}
    @Test
    public void fullPokerFlowWith3Participants() throws InterruptedException {
        String roomCode = "testroom";
        String baseUrl = "http://localhost:" + port;

        hostDriver.get(baseUrl + "/room?roomCode=" + roomCode + "&participantName=Roland");
        participant1.get(baseUrl + "/room?roomCode=" + roomCode + "&participantName=Julia");
        participant2.get(baseUrl + "/room?roomCode=" + roomCode + "&participantName=Max");

        Thread.sleep(1500); // WebSocket stabilisieren

        String card1 = chooseRandomCardAndClick(participant1);
        String card2 = chooseRandomCardAndClick(participant2);
        String card3 = chooseRandomCardAndClick(hostDriver);

        System.out.printf("🎴 Julia: %s, Max: %s, Roland: %s%n", card1, card2, card3);

        Thread.sleep(500); // Votes verarbeiten lassen

        hostDriver.findElement(By.xpath("//button[contains(text(),'aufdecken')]")).click();

        new WebDriverWait(hostDriver, Duration.ofSeconds(5))
                .until(driver -> driver.findElement(By.id("averageVote")));

        String avgText = hostDriver.findElement(By.id("averageVote")).getText();
        System.out.println("▶ Durchschnitt angezeigt: " + avgText);

        double expectedAverage = calculateExpectedAverage(card1, card2, card3);
        System.out.println("📏 Erwarteter Durchschnitt: " + expectedAverage);

        if (Double.isNaN(expectedAverage)) {
            assertEquals("N/A", avgText.trim(), "Erwartet wurde 'N/A' für Sonderkarten");
        } else {
            String normalized = avgText.replace(",", ".").replaceAll("[^0-9.]", "");
            try {
                double actual = Double.parseDouble(normalized);
                assertEquals(expectedAverage, actual, 0.1, "Durchschnitt weicht ab");
            } catch (NumberFormatException e) {
                fail("Kein gültiger Durchschnittswert gefunden: " + avgText);
            }
        }
    }

    private String chooseRandomCardAndClick(WebDriver driver) {
        String value = cardPool.get(random.nextInt(cardPool.size()));
        try {
            driver.findElement(By.xpath("//button[text()='" + value + "']")).click();
        } catch (NoSuchElementException e) {
            // Für Emoji-Karten wie 📣 ist text() manchmal nicht exakt – Workaround:
            List<WebElement> buttons = driver.findElements(By.cssSelector(".card-grid button"));
            for (WebElement btn : buttons) {
                if (btn.getText().trim().equals(value)) {
                    btn.click();
                    break;
                }
            }
        }
        return value;
    }

    private double calculateExpectedAverage(String... votes) {
        return Arrays.stream(votes)
                .filter(v -> v.matches("\\d+"))
                .mapToInt(Integer::parseInt)
                .average()
                .orElse(Double.NaN);
    }
}
