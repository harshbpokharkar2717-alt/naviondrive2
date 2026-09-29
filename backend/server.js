const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

let latestSimulationState = {
    speed: 0,
    egoS: 0,
    egoLane: 1,
    targetLane: 1,
    vehicles: 0,
    pedestrians: 0,
    animals: 0,
    potholes: 0,
    controllerMode: "CRUISE",
    radarZone: "NONE",
    radarGap: null,
    radarTtc: null,
    timestamp: null,
};

// ===============================
// HEALTH
// ===============================

app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        system: "NAVION",
        backend: "Node.js + Express"
    });
});

// ===============================
// RECEIVE LIVE SIMULATION DATA
// ===============================

app.post("/api/simulation/state", (req, res) => {
    latestSimulationState = {
        ...latestSimulationState,
        ...req.body,
        timestamp: new Date().toISOString()
    };

    console.log("NAVION simulation data received:");
    console.log(latestSimulationState);

    res.json({
        received: true,
        data: latestSimulationState
    });
});

// ===============================
// VIEW LIVE SIMULATION DATA
// ===============================

app.get("/api/simulation/state", (req, res) => {
    res.json({
        system: "NAVION",
        simulation: latestSimulationState
    });
});

// ===============================
// NAVION AI DECISION ENGINE
// ===============================

app.get("/api/ai/decision", (req, res) => {
    const state = latestSimulationState;

    let decision = "CRUISE";
    let reason = "ROAD CLEAR";

    const currentLane = Number.isFinite(Number(state.egoLane))
        ? Number(state.egoLane)
        : 1;

    let targetLane = Number.isFinite(Number(state.targetLane))
        ? Number(state.targetLane)
        : currentLane;

    let risk = "LOW";
    let confidence = 0.90;

    // Emergency situation
    if (
        state.radarTtc !== null &&
        Number.isFinite(Number(state.radarTtc)) &&
        Number(state.radarTtc) < 2.0
    ) {
        decision = "EMERGENCY BRAKE";
        reason = "CRITICAL TIME TO COLLISION";
        risk = "CRITICAL";
        confidence = 0.98;
    }

    // Pedestrian detected
    else if (Number(state.pedestrians) > 0) {
        decision = "AVOID PEDESTRIAN";
        reason = "PEDESTRIAN DETECTED";
        risk = "HIGH";
        confidence = 0.96;
    }

    // Pothole detected
    else if (Number(state.potholes) > 0) {
        decision = "AVOID POTHOLE";
        reason = "ROAD HAZARD DETECTED";

        if (currentLane < 3) {
            targetLane = currentLane + 1;
        } else {
            targetLane = currentLane - 1;
        }

        risk = "MEDIUM";
        confidence = 0.94;
    }

    // Vehicle close ahead
    else if (
        state.radarGap !== null &&
        Number.isFinite(Number(state.radarGap)) &&
        Number(state.radarGap) < 25
    ) {
        decision = "ASSESS OVERTAKE";
        reason = "VEHICLE AHEAD WITHIN CLOSE RANGE";
        risk = "MEDIUM";
        confidence = 0.91;
    }

    // Normal driving
    else {
        decision = "CRUISE";
        reason = "ROAD CLEAR";
        risk = "LOW";
        confidence = 0.90;
    }

    res.json({
        system: "NAVION AI",
        timestamp: new Date().toISOString(),

        decision,
        reason,

        currentLane,
        targetLane,

        risk,
        confidence,

        speed: state.speed,
        radarZone: state.radarZone,
        radarGap: state.radarGap,
        radarTtc: state.radarTtc,

        vehicles: state.vehicles,
        pedestrians: state.pedestrians,
        animals: state.animals,
        potholes: state.potholes,

        controllerMode: state.controllerMode
    });
});

// ===============================
// START SERVER
// ===============================

const PORT = 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log("==================================");
    console.log("       NAVION BACKEND ONLINE");
    console.log("==================================");
    console.log(`Backend: http://localhost:${PORT}`);
    console.log(`Health:  http://localhost:${PORT}/api/health`);
    console.log(`State:   http://localhost:${PORT}/api/simulation/state`);
    console.log(`AI:      http://localhost:${PORT}/api/ai/decision`);
    console.log("==================================");
});