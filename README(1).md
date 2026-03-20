# GigShield
## AI-Powered Parametric Income Insurance for Food Delivery Partners
India has over 5 million food delivery partners working for Zomato and Swiggy. On a heavy-rain evening in Mumbai, a Swiggy rider can lose 4–6 hours of earning time — not because he chose to stop working, but because the platform halted order assignment and the roads became impassable. That is ₹300–600 gone with no recourse.
Currently, no insurance product exists that compensates a gig worker for income lost to external, uncontrollable disruptions. When heavy rain, severe pollution, or a sudden curfew shuts down deliveries, they bear 100% of the loss. GigShield changes that.

GigShield is an AI-enabled parametric insurance platform that protects Zomato and Swiggy delivery partners against income loss caused by external disruptions.
Parametric means payouts are triggered by an objective, third-party-verified measurement — rainfall exceeding 15mm/hr, AQI above 300, temperature above 42°C — not by the worker filing a claim and waiting for assessment. When a threshold is crossed, the system automatically checks whether the worker has an active policy, runs fraud screening across three independent detection engines, calculates how much they are owed, and sends money to their UPI ID. Target time: under 5 minutes. Zero human involvement. Zero forms.
Coverage scope: income loss only. We strictly exclude health, life, accident, and vehicle repair coverage.

## Persona: Zomato / Swiggy Food Delivery Partner

We chose food delivery as our target persona for two reasons:
Outdoor and weather-sensitive. Every shift is in the open. A monsoon evening eliminates earnings directly. An AQI advisory makes outdoor work dangerous. There is no indoor fallback.
Compounding peak-hour income loss. Zomato and Swiggy bonus structures reward surge hours. A disruption at 7–9 PM does not cost a worker just their hourly base — it also wipes out surge bonuses that can double effective earnings. The real loss is 1.5–2× the headline figure.
Week-to-week earnings cycle. Partners are paid by platforms every 7 days. There is no monthly salary to buffer a bad week. If Tuesday evening is lost to rain, the impact is felt by Saturday. This is exactly why weekly insurance pricing makes sense.
Persona Scenarios

### Scenario A — Heavy Rain, Mumbai, July
Ravi is a Swiggy partner in Kurla, logged in at 7 PM peak. IMD issues an Orange alert; rainfall exceeds 22mm/hr. Swiggy pauses order assignment in Kurla. GigShield's trigger engine detects the IMD alert via OpenWeatherMap, confirms Ravi had an active Pro Shield policy, runs GPS validation (his coordinates are inside the Kurla bounding box), passes fraud screening, and transfers ₹280 (3.5 hours × ₹80/hr) to his UPI in under 5 minutes. Ravi receives a push notification. He filed nothing.
### Scenario B — Severe AQI, Delhi, November
Priya is a Zomato partner in Dwarka. She opens the app to find AQI at 340 — Severe category. Delhi's Graded Response Action Plan has activated outdoor work advisories. GigShield's AQI trigger fires (threshold: 300), confirms Priya's Basic Shield is active, and issues a payout for the 4-hour advisory window: ₹300 credited to her UPI.

## Weekly Premium Model
Gig workers are paid weekly by their platforms. Our premium cycle aligns to this so workers can opt in, opt out, or upgrade without long-term commitment.

## Insurance Plans (Base Tiers)

| Plan Name     | Base Premium | Covered Triggers                          | Max Payout / Week |
|---------------|-------------|-------------------------------------------|-------------------|
| Basic Shield  | ₹29/week    | Rain, AQI                                 | ₹600              |
| Pro Shield    | ₹49/week    | Rain, AQI, Heat, Curfew                   | ₹1,200            |
| Max Shield    | ₹79/week    | Rain, AQI, Heat, Curfew, Flood            | ₹2,000            |

---

## Dynamic Pricing via ML

The base premium is dynamically adjusted every week using a trained `GradientBoostingRegressor` model.

### Features Used in Pricing Model

| Feature                          | Weight | Example                                      |
|----------------------------------|--------|----------------------------------------------|
| Zone flood / rain risk score     | 35%    | Kurla (0.91) vs Bandra (0.65)                |
| Seasonal factor                  | 25%    | July monsoon = 1.45×                         |
| Worker hours per week            | 20%    | 55h/week vs 30h/week                         |
| Platform (Swiggy/Zomato)         | 10%    | Swiggy = slight surcharge                    |
| Claim history                    | 10%    | New worker = 5% loyalty discount             |

## Why GigShield
Zero friction for the worker. There is no claim form, no waiting, no proof of income required. The moment rainfall exceeds threshold in their zone and their policy is active, the money moves. Workers adopt products that require no effort to benefit from.
Actuarially sound. Dynamic pricing based on real zone risk means the risk pool is fairly priced. A rider in flood-prone Kurla pays more than one in stable Koramangala — not a flat rate that either overcharges the Bengaluru rider or bankrupts the insurer on Mumbai payouts.
Three-layer fraud defence. Parametric triggers already eliminate the largest fraud vector (fabricated claims) because the weather data is independent. On top of that, GPS spoofing detection catches workers faking their location, and cluster detection catches rings of coordinated bad actors — all before a single rupee leaves the insurer's pool.
Aligned to how gig workers actually live. Weekly pricing. UPI payout. No paperwork. No app store. No commitment. These are not nice-to-haves — they are the difference between a product that gets adopted and one that does not.

# GigShield — because every disrupted hour deserves a safety net.
