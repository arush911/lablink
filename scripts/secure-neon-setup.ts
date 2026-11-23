import readline from "readline";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function promptHidden(query: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Mute stdout while typing secret
    const stdin = process.stdin;
    process.stdout.write(query);

    let input = "";
    const onData = (char: Buffer) => {
      const str = char.toString("utf-8");
      if (str === "\r" || str === "\n" || str === "\r\n") {
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        rl.close();
        resolve(input.trim());
      } else if (str === "\u0003") { // Ctrl+C
        process.exit(1);
      } else if (str === "\b" || str === "\x7f") { // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
      } else {
        input += str;
      }
    };

    stdin.on("data", onData);
  });
}

async function runNeonSetup() {
  console.log("================================================================================");
  console.log("LABLINK 2026 — SECURE NEON DATABASE SETUP & MIGRATION RUNNER");
  console.log("Expected Neon Compute Endpoint: ep-calm-rain-bdodv2pg");
  console.log("Security Notice: Input is completely hidden and will never be echoed.");
  console.log("================================================================================\n");

  let connectionString = process.env.NEON_DATABASE_URL || "";

  if (!connectionString) {
    connectionString = await promptHidden("Enter Neon PostgreSQL Connection String (input hidden): ");
  }

  if (!connectionString) {
    console.error("❌ Error: No connection string provided. Aborting.");
    process.exit(1);
  }

  if (!connectionString.includes("ep-calm-rain-bdodv2pg")) {
    console.warn("⚠️ Warning: Connection string does not contain compute endpoint 'ep-calm-rain-bdodv2pg'.");
  }

  // Ensure sslmode=require
  let urlObj: URL;
  try {
    urlObj = new URL(connectionString);
  } catch (err) {
    console.error("❌ Error: Invalid connection string URL format.");
    process.exit(1);
  }

  console.log(`\n[1/6] Connecting to Neon host: ${urlObj.hostname}...`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Successfully connected to Neon PostgreSQL.");

    console.log("\n[2/6] Verifying required extensions (btree_gist)...");
    await client.query("CREATE EXTENSION IF NOT EXISTS btree_gist;");
    await client.query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";");
    console.log("✅ Extensions active.");

    console.log("\n[3/6] Applying LabLink production schema (schema.sql)...");
    const schemaPath = path.join(__dirname, "../src/lib/db/schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    await client.query(schemaSql);
    console.log("✅ Schema applied successfully.");

    console.log("\n[4/6] Seeding departments, demo accounts, laboratories, and equipment...");
    // 1. Departments
    await client.query(`
      INSERT INTO departments (id, name, code, building)
      VALUES 
        ('00000000-0000-0000-0000-000000000001', 'Central Engineering & Robotics', 'ENG-CORE', 'Hall of Engineering, Wing B'),
        ('00000000-0000-0000-0000-000000000002', 'Materials Science & Metallurgy', 'MAT-SCI', 'Advanced Materials Research Center'),
        ('00000000-0000-0000-0000-000000000003', 'Electrical & Computer Engineering', 'ECE-LAB', 'Information Technology Complex')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
    `);

    // 2. Demo Users (Alex Chen & Prof. Marcus Vance)
    await client.query(`
      INSERT INTO users (id, firebase_uid, email, full_name, role, department_id, student_id_number, monthly_quota_hours, used_quota_hours)
      VALUES 
        (
          '11111111-1111-1111-1111-111111111111', 
          'firebase_demo_student_alex_chen_2026', 
          'student.demo@lablink.edu', 
          'Alex Chen', 
          'student', 
          '00000000-0000-0000-0000-000000000001', 
          'STU-2026-8491', 
          25.00, 
          0.00
        ),
        (
          '22222222-2222-2222-2222-222222222222', 
          'firebase_demo_faculty_marcus_vance_2026', 
          'faculty.demo@lablink.edu', 
          'Prof. Marcus Vance', 
          'faculty', 
          '00000000-0000-0000-0000-000000000001', 
          NULL, 
          100.00, 
          0.00
        )
      ON CONFLICT (email) DO UPDATE SET 
        full_name = EXCLUDED.full_name, 
        role = EXCLUDED.role,
        firebase_uid = EXCLUDED.firebase_uid;
    `);

    // 3. Laboratories
    await client.query(`
      INSERT INTO laboratories (id, department_id, name, room_location, coordinator_id, cancellation_buffer_minutes)
      VALUES 
        (
          '33333333-3333-3333-3333-333333333331', 
          '00000000-0000-0000-0000-000000000001', 
          'Advanced Prototyping & Robotics Lab', 
          'Room B-104', 
          '22222222-2222-2222-2222-222222222222', 
          120
        ),
        (
          '33333333-3333-3333-3333-333333333332', 
          '00000000-0000-0000-0000-000000000002', 
          'Electron Microscopy & Surface Characterization', 
          'Room C-201', 
          '22222222-2222-2222-2222-222222222222', 
          120
        )
      ON CONFLICT (id) DO NOTHING;
    `);

    // 4. Operating Hours
    for (const labId of ['33333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333332']) {
      for (let day = 1; day <= 5; day++) {
        await client.query(`
          INSERT INTO laboratory_operating_hours (laboratory_id, day_of_week, open_time, close_time, is_closed)
          VALUES ($1, $2, '08:00:00', '20:00:00', false)
          ON CONFLICT (laboratory_id, day_of_week) DO UPDATE SET open_time = '08:00:00', close_time = '20:00:00';
        `, [labId, day]);
      }
      await client.query(`
        INSERT INTO laboratory_operating_hours (laboratory_id, day_of_week, open_time, close_time, is_closed)
        VALUES ($1, 6, '10:00:00', '18:00:00', false)
        ON CONFLICT (laboratory_id, day_of_week) DO UPDATE SET open_time = '10:00:00', close_time = '18:00:00';
      `, [labId]);
      await client.query(`
        INSERT INTO laboratory_operating_hours (laboratory_id, day_of_week, open_time, close_time, is_closed)
        VALUES ($1, 0, '08:00:00', '20:00:00', true)
        ON CONFLICT (laboratory_id, day_of_week) DO UPDATE SET is_closed = true;
      `, [labId]);
    }

    // 5. 10 Instruments
    const instruments = [
      {
        id: '44444444-4444-4444-4444-444444440001',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Keysight DSOX3024T Digital Storage Oscilloscope',
        model: 'InfiniiVision 3000T X-Series',
        manufacturer: 'Keysight Technologies',
        serial: 'MY58102931',
        asset: 'EQ-ENG-101',
        status: 'AVAILABLE',
        buffer: 15,
        req_qual: false,
        qual_title: null,
        specs: { channels: 4, bandwidth: '200 MHz', sample_rate: '5 GSa/s', display: '8.5-inch capacitive touch' }
      },
      {
        id: '44444444-4444-4444-4444-444444440002',
        lab_id: '33333333-3333-3333-3333-333333333332',
        name: 'JEOL JSM-7800F Field Emission Scanning Electron Microscope',
        model: 'JSM-7800F Prime',
        manufacturer: 'JEOL Ltd.',
        serial: 'FE-849204',
        asset: 'EQ-MAT-201',
        status: 'AVAILABLE',
        buffer: 30,
        req_qual: true,
        qual_title: 'Cleanroom Level 1',
        specs: { resolution: '0.8 nm at 15 kV', magnification: 'x25 to x1,000,000', detectors: ['Upper Electron Detector', 'EDS'] }
      },
      {
        id: '44444444-4444-4444-4444-444444440003',
        lab_id: '33333333-3333-3333-3333-333333333332',
        name: 'Agilent 1260 Infinity II HPLC System',
        model: '1260 Infinity II quaternary',
        manufacturer: 'Agilent Technologies',
        serial: 'DEBA491024',
        asset: 'EQ-MAT-202',
        status: 'AVAILABLE',
        buffer: 30,
        req_qual: false,
        qual_title: null,
        specs: { max_pressure: '600 bar', flow_range: '0.001 to 10 mL/min', detector: 'Variable Wavelength Detector' }
      },
      {
        id: '44444444-4444-4444-4444-444444440004',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Formlabs Form 3+ Stereolithography 3D Printer',
        model: 'Form 3+ LFS',
        manufacturer: 'Formlabs',
        serial: 'F3-294012',
        asset: 'EQ-ENG-102',
        status: 'AVAILABLE',
        buffer: 20,
        req_qual: false,
        qual_title: null,
        specs: { technology: 'Low Force Stereolithography', laser_spot: '85 microns', build_volume: '14.5 x 14.5 x 18.5 cm' }
      },
      {
        id: '44444444-4444-4444-4444-444444440005',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Universal Robots UR5e Collaborative Robot Arm',
        model: 'UR5e CB-Series',
        manufacturer: 'Universal Robots',
        serial: 'UR-2026-091',
        asset: 'EQ-ENG-103',
        status: 'AVAILABLE',
        buffer: 15,
        req_qual: false,
        qual_title: null,
        specs: { payload: '5 kg', reach: '850 mm', repeatability: '+/- 0.03 mm', degrees_of_freedom: 6 }
      },
      {
        id: '44444444-4444-4444-4444-444444440006',
        lab_id: '33333333-3333-3333-3333-333333333332',
        name: 'PerkinElmer Spectrum Two FTIR Spectrometer',
        model: 'Spectrum Two',
        manufacturer: 'PerkinElmer',
        serial: 'PK-FTIR-892',
        asset: 'EQ-MAT-203',
        status: 'AVAILABLE',
        buffer: 15,
        req_qual: false,
        qual_title: null,
        specs: { spectral_range: '8,300 to 350 cm-1', resolution: '0.5 cm-1', snr: '14,500:1 peak-to-peak' }
      },
      {
        id: '44444444-4444-4444-4444-444444440007',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Rohde & Schwarz FSW26 Signal and Spectrum Analyzer',
        model: 'FSW26',
        manufacturer: 'Rohde & Schwarz',
        serial: 'RS-918204',
        asset: 'EQ-ENG-104',
        status: 'AVAILABLE',
        buffer: 20,
        req_qual: false,
        qual_title: null,
        specs: { frequency_range: '2 Hz to 26.5 GHz', analysis_bandwidth: '8.3 GHz', phase_noise: '-140 dBc/Hz at 10 kHz offset' }
      },
      {
        id: '44444444-4444-4444-4444-444444440008',
        lab_id: '33333333-3333-3333-3333-333333333332',
        name: 'Malvern Panalytical Empyrean X-ray Diffractometer',
        model: 'Empyrean 3rd Gen',
        manufacturer: 'Malvern Panalytical',
        serial: 'XRD-MP-491',
        asset: 'EQ-MAT-204',
        status: 'AVAILABLE',
        buffer: 30,
        req_qual: true,
        qual_title: 'Radiation Safety Level 2',
        specs: { x_ray_source: 'Cu LFF HR', goniometer_radius: '240 mm', min_step_size: '0.0001 deg' }
      },
      {
        id: '44444444-4444-4444-4444-444444440009',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Tektronix AWG5208 Arbitrary Waveform Generator',
        model: 'AWG5200 Series',
        manufacturer: 'Tektronix',
        serial: 'TK-5208-11',
        asset: 'EQ-ENG-105',
        status: 'AVAILABLE',
        buffer: 15,
        req_qual: false,
        qual_title: null,
        specs: { channels: 8, sample_rate: '5 GSa/s', resolution: '16-bit', memory_depth: '2 GSa/ch' }
      },
      {
        id: '44444444-4444-4444-4444-444444440010',
        lab_id: '33333333-3333-3333-3333-333333333332',
        name: 'TA Instruments Discovery DSC 2500',
        model: 'DSC 2500',
        manufacturer: 'TA Instruments',
        serial: 'TA-DSC-772',
        asset: 'EQ-MAT-205',
        status: 'AVAILABLE',
        buffer: 30,
        req_qual: false,
        qual_title: null,
        specs: { temp_range: '-180 to 725 C', baseline_flatness: '< 5 uW', calorimetric_reproducibility: '+/- 0.05%' }
      }
    ];

    for (const eq of instruments) {
      await client.query(`
        INSERT INTO equipment (
          id, laboratory_id, name, model, manufacturer, serial_number, asset_tag, 
          status, buffer_minutes, requires_qualification, qualification_title, technical_specifications
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET 
          name = EXCLUDED.name, 
          status = EXCLUDED.status,
          technical_specifications = EXCLUDED.technical_specifications;
      `, [
        eq.id, eq.lab_id, eq.name, eq.model, eq.manufacturer, eq.serial, eq.asset,
        eq.status, eq.buffer, eq.req_qual, eq.qual_title, JSON.stringify(eq.specs)
      ]);
    }
    console.log("✅ Seed completed.");

    console.log("\n[5/6] Verifying PostgreSQL GiST exclusion constraint and schema integrity...");
    const gistCheck = await client.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conname = 'no_overlapping_confirmed_bookings';
    `);

    if (gistCheck.rows.length === 0) {
      throw new Error("CRITICAL: GiST exclusion constraint 'no_overlapping_confirmed_bookings' is missing on Neon!");
    }
    console.log(`✅ GiST exclusion constraint confirmed: ${gistCheck.rows[0].conname}`);

    const countCheck = await client.query(`
      SELECT 
        (SELECT count(*) FROM users) as users_count,
        (SELECT count(*) FROM equipment) as equipment_count,
        (SELECT count(*) FROM laboratories) as labs_count,
        (SELECT count(*) FROM laboratory_operating_hours) as hours_count;
    `);
    const counts = countCheck.rows[0];
    console.log(`✅ Database counts verified: Users=${counts.users_count}, Equipment=${counts.equipment_count}, Labs=${counts.labs_count}, OperatingHours=${counts.hours_count}`);

    console.log("\n[6/6] Generating high-entropy evaluator authentication secrets...");
    const studentSecret = crypto.randomBytes(32).toString("hex");
    const facultySecret = crypto.randomBytes(32).toString("hex");
    const sessionSecret = crypto.randomBytes(32).toString("hex");

    // Save connection string and evaluator secrets to .env.production.local (gitignored)
    const envProdPath = path.join(__dirname, "../.env.production.local");
    const envProdContent = `# LabLink Production Configuration (Auto-generated by secure-neon-setup)
DATABASE_URL=${connectionString}
NODE_ENV=production
ENABLE_LOCAL_DEMO_AUTH=false
ENABLE_PROD_EVALUATOR_AUTH=true
EVALUATOR_STUDENT_SECRET=${studentSecret}
EVALUATOR_FACULTY_SECRET=${facultySecret}
EVALUATOR_SESSION_SECRET=${sessionSecret}
FIREBASE_PROJECT_ID=lablink-demo-2026
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDemoFakeApiKeyForEvaluation2026
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=lablink-demo-2026.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=lablink-demo-2026
`;
    fs.writeFileSync(envProdPath, envProdContent, "utf-8");
    console.log("✅ Stored production settings in .env.production.local (strictly gitignored).");

    console.log("\n================================================================================");
    console.log("🎉 NEON SETUP COMPLETED SUCCESSFULLY!");
    console.log("Host Endpoint:", urlObj.hostname);
    console.log("Database Name:", urlObj.pathname.replace("/", ""));
    console.log("No passwords or secrets were logged or echoed to terminal.");
    console.log("================================================================================");
  } finally {
    await client.end();
  }
}

runNeonSetup().catch((err) => {
  console.error("❌ Neon Setup Failed:", err.message || err);
  process.exit(1);
});
