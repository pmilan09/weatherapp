// Egyszerű, időjáráson alapuló becslések az új kártyákhoz.
function activity_card(title, result, description) {
  return `
    <div class="col-12 col-md-6 col-lg-4">
      <article class="weather-card activity-card">
        <h2>${title}</h2>
        <strong>${result}</strong>
        <p>${description}</p>
      </article>
    </div>
  `;
}

function forecast_time(time) {
  // Az API a keresett város helyi idejét adja vissza.
  return time.slice(5, 10).replace("-", ". ") + ". " + time.slice(11, 16);
}

function good_weather(hourly, index) {
  return hourly.apparent_temperature[index] !== null &&
    hourly.precipitation[index] !== null &&
    hourly.precipitation_probability[index] !== null &&
    hourly.wind_speed_10m[index] !== null &&
    hourly.weather_code[index] !== null &&
    hourly.apparent_temperature[index] >= 10 &&
    hourly.apparent_temperature[index] <= 28 &&
    hourly.precipitation[index] <= 0.1 &&
    hourly.precipitation_probability[index] < 40 &&
    hourly.wind_speed_10m[index] < 25 &&
    hourly.weather_code[index] <= 3;
}

function show_activity_cards(weather) {
  const current = weather.current;
  const hourly = weather.hourly;
  let cards = "";

  // Az aktuális óra megkeresése a város helyi ideje szerint.
  let hour = -1;
  if (hourly && hourly.time) {
    hour = hourly.time.indexOf(current.time.slice(0, 13) + ":00");
  }

  // Hiányzó adatokból ne adjunk kedvező ajánlást.
  if (hour !== -1) {
    const fields = ["apparent_temperature", "precipitation", "precipitation_probability",
      "weather_code", "wind_speed_10m", "visibility", "cloud_cover", "is_day"];
    for (let i = 0; i < fields.length; i++) {
      if (!hourly[fields[i]] || typeof hourly[fields[i]][hour] !== "number") {
        hour = -1;
        break;
      }
    }
    const currentFields = ["apparent_temperature", "precipitation", "weather_code", "wind_speed_10m"];
    for (let i = 0; i < currentFields.length; i++) {
      if (typeof current[currentFields[i]] !== "number") hour = -1;
    }
  }

  if (hour === -1) {
    const titles = ["Vezetés", "Futás", "Horgászat", "Kabát / esernyő", "Csillagászat", "Meddig lesz jó az idő?"];
    for (let i = 0; i < titles.length; i++) {
      cards += activity_card(titles[i], "Nincs elég adat", "Az óránkénti előrejelzés nem érhető el.");
    }
  } else {
    const temperature = current.apparent_temperature;
    const wind = current.wind_speed_10m;
    const rain = current.precipitation;
    const code = current.weather_code;
    const probability = hourly.precipitation_probability[hour];
    const visibility = hourly.visibility[hour];
    const storm = code >= 95;
    const snowOrIce = code === 56 || code === 57 || code === 66 || code === 67 ||
      (code >= 71 && code <= 77) || code === 85 || code === 86;
    const fog = code === 45 || code === 48;
    const wet = rain > 0 || probability >= 40 || (code >= 51 && code <= 99);
    const details = Math.round(temperature) + " °C hőérzet, " + Math.round(wind) + " km/h szél.";

    let driving = "Kedvező";
    let drivingText = "Nem látszik jelentős időjárási akadály. " + details;
    if (storm || snowOrIce || wind >= 50 || (visibility !== null && visibility < 1000)) {
      driving = "Kedvezőtlen";
      drivingText = "Zivatar, erős szél, téli csapadék vagy rossz látási viszonyok várhatók.";
    } else if (wet || fog || temperature <= 2 || wind >= 30 || (visibility !== null && visibility < 5000)) {
      driving = "Fokozott óvatosság";
      drivingText = "Csapadék, hideg, szél vagy köd nehezítheti a vezetést. " + details;
    } else if (visibility === null) {
      driving = "Hiányos adatok";
      drivingText = "A látótávolság adata nem érhető el. " + details;
    }
    cards += activity_card("Vezetés", driving, drivingText + " Az út állapotát ez a becslés nem ismeri.");

    let running = "Kedvező";
    if (storm || snowOrIce || temperature < 0 || temperature >= 30 || wind >= 40 || rain >= 2) {
      running = "Nem ajánlott";
    } else if (wet || fog || temperature < 5 || temperature > 25 || wind >= 25) {
      running = "Kevésbé kedvező";
    }
    cards += activity_card("Futás", running, details + " Csapadékesély ebben az órában: " + probability + "%.");

    let fishing = "Kedvező";
    if (storm || snowOrIce || wind >= 30 || rain >= 2 || temperature < 0) {
      fishing = "Nem ajánlott";
    } else if (wet || fog || temperature < 10 || temperature > 30 || wind >= 20) {
      fishing = "Kevésbé kedvező";
    }
    cards += activity_card("Horgászat", fishing, details + " A becslés a kinti tartózkodásra vonatkozik, a kapást nem jelzi előre.");

    let clothing = "Kabát nem szükséges";
    if (temperature < 10) {
      clothing = "Meleg kabát ajánlott";
    } else if (temperature < 18) {
      clothing = "Könnyű kabát ajánlott";
    }
    let umbrella = "Esernyő várhatóan nem kell.";
    if (storm || wind >= 40) {
      umbrella = "Erős szélben vagy zivatarban az esernyő helyett keress fedett helyet.";
    } else if (wet) {
      umbrella = "Vigyél esernyőt vagy esőkabátot.";
    }
    cards += activity_card("Kabát / esernyő", clothing, umbrella + " Hőérzet: " + Math.round(temperature) + " °C.");

    // A következő éjszaka (vagy a jelenlegi éjszaka hátralévő) óráit vizsgáljuk.
    let nightStart = -1;
    let bestNightHour = -1;
    for (let i = hour; i < hourly.time.length; i++) {
      if (hourly.is_day[i] === 0) {
        if (nightStart === -1) nightStart = i;
        if (hourly.cloud_cover[i] !== null && hourly.cloud_cover[i] <= 25 &&
            hourly.visibility[i] !== null && hourly.visibility[i] >= 10000 &&
            hourly.precipitation[i] === 0 && hourly.precipitation_probability[i] !== null &&
            hourly.precipitation_probability[i] < 20 && hourly.wind_speed_10m[i] !== null &&
            hourly.wind_speed_10m[i] < 20 && hourly.weather_code[i] !== null && hourly.weather_code[i] <= 3) {
          bestNightHour = i;
          break;
        }
      } else if (nightStart !== -1) {
        break;
      }
    }
    let astronomy = "Kevésbé kedvező";
    let astronomyText = "A vizsgált éjszakán nem látszik derült, száraz és szélcsendes óra.";
    if (nightStart === -1) {
      astronomy = "Nincs éjszakai adat";
      astronomyText = "Az előrejelzésben nem található éjszakai időszak.";
    } else if (bestNightHour !== -1) {
      astronomy = "Várható kedvező időszak";
      astronomyText = forecast_time(hourly.time[bestNightHour]) + " körül: " +
        hourly.cloud_cover[bestNightHour] + "% felhőzet. A fényszennyezést és a holdfényt nem vizsgáljuk.";
    }
    cards += activity_card("Csillagászat", astronomy, astronomyText);

    let goodUntil = "Most nem kedvező az idő";
    let goodUntilText = "Jó idő: 10–28 °C hőérzet, legfeljebb 0,1 mm csapadék, 40% alatti csapadékesély, 25 km/h alatti szél, köd és zivatar nélkül.";
    if (good_weather(hourly, hour) && temperature >= 10 && temperature <= 28 &&
        rain <= 0.1 && wind < 25 && code <= 3) {
      let end = hour + 1;
      while (end < hourly.time.length && good_weather(hourly, end)) {
        end++;
      }
      if (end < hourly.time.length) {
        goodUntil = "Várhatóan " + forecast_time(hourly.time[end]) + "-ig";
      } else {
        goodUntil = "Legalább " + forecast_time(hourly.time[end - 1]) + "-ig";
      }
    }
    cards += activity_card("Meddig lesz jó az idő?", goodUntil, goodUntilText);
  }

  document.getElementById("weather").insertAdjacentHTML("beforeend", `
    <section class="activity-section" aria-label="Időjárási ajánlások">
      <p class="activity-note">Egyszerű időjárási becslések. Az időpontok a keresett város helyi idejét mutatják.</p>
      <div class="row g-3">${cards}</div>
    </section>
  `);
}
