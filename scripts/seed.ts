import { Client } from "pg";

const PG_HOST = process.env.PGHOST || "localhost";
const PG_PORT = parseInt(process.env.PGPORT || "5432", 10);
const PG_USER = process.env.PGUSER || "postgres";
const PG_PASSWORD = process.env.PGPASSWORD || "postgres";

async function runSeed() {
  console.log("=== LabLink 2026 Seed Runner ===");
  const client = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: "lablink",
  });

  await client.connect();

  try {
    console.log("Seeding departments...");
    const deptRes = await client.query(`
      INSERT INTO departments (id, name, code, building)
      VALUES 
        ('00000000-0000-0000-0000-000000000001', 'Central Engineering & Robotics', 'ENG-CORE', 'Hall of Engineering, Wing B'),
        ('00000000-0000-0000-0000-000000000002', 'Materials Science & Metallurgy', 'MAT-SCI', 'Advanced Materials Research Center'),
        ('00000000-0000-0000-0000-000000000003', 'Electrical & Computer Engineering', 'ECE-LAB', 'Information Technology Complex')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, code;
    `);

    console.log("Seeding demonstration accounts...");
    const userRes = await client.query(`
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
          4.50
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
        firebase_uid = EXCLUDED.firebase_uid
      RETURNING id, full_name, role, email;
    `);

    userRes.rows.forEach((u) => {
      console.log(`  - ${u.role.toUpperCase()}: ${u.full_name} (${u.email})`);
    });

    console.log("Seeding laboratories...");
    const labRes = await client.query(`
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
      ON CONFLICT (id) DO NOTHING
      RETURNING id, name;
    `);

    console.log("Seeding operating hours for laboratories...");
    for (const labId of [
      '33333333-3333-3333-3333-333333333331',
      '33333333-3333-3333-3333-333333333332'
    ]) {
      // Days 1-5 (Mon-Fri) 08:00 - 20:00
      for (let day = 1; day <= 5; day++) {
        await client.query(`
          INSERT INTO laboratory_operating_hours (laboratory_id, day_of_week, open_time, close_time, is_closed)
          VALUES ($1, $2, '08:00:00', '20:00:00', false)
          ON CONFLICT (laboratory_id, day_of_week) DO UPDATE SET open_time = '08:00:00', close_time = '20:00:00';
        `, [labId, day]);
      }
      // Saturday 10:00 - 18:00
      await client.query(`
        INSERT INTO laboratory_operating_hours (laboratory_id, day_of_week, open_time, close_time, is_closed)
        VALUES ($1, 6, '10:00:00', '18:00:00', false)
        ON CONFLICT (laboratory_id, day_of_week) DO UPDATE SET open_time = '10:00:00', close_time = '18:00:00';
      `, [labId]);
      // Sunday closed
      await client.query(`
        INSERT INTO laboratory_operating_hours (laboratory_id, day_of_week, open_time, close_time, is_closed)
        VALUES ($1, 0, '08:00:00', '20:00:00', true)
        ON CONFLICT (laboratory_id, day_of_week) DO UPDATE SET is_closed = true;
      `, [labId]);
    }

    console.log("Seeding 10 synthetic instruments...");
    const equipmentData = [
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
        specs: { max_pressure: '600 bar', flow_rate: '0.2 to 10 mL/min', detector: 'Diode Array Detector (DAD)' }
      },
      {
        id: '44444444-4444-4444-4444-444444440004',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Formlabs Form 3+ Stereolithography (SLA) 3D Printer',
        model: 'Form 3+ Industrial',
        manufacturer: 'Formlabs',
        serial: 'FL-3P-9921',
        asset: 'EQ-ENG-102',
        status: 'AVAILABLE',
        buffer: 20,
        req_qual: false,
        qual_title: null,
        specs: { technology: 'Low Force Stereolithography (LFS)', laser_spot_size: '85 microns', build_volume: '14.5 x 14.5 x 18.5 cm' }
      },
      {
        id: '44444444-4444-4444-4444-444444440005',
        lab_id: '33333333-3333-3333-3333-333333333332',
        name: 'Leica TCS SP8 Confocal Laser Scanning Microscope',
        model: 'TCS SP8 DLS',
        manufacturer: 'Leica Microsystems',
        serial: 'LC-SP8-3920',
        asset: 'EQ-MAT-203',
        status: 'AVAILABLE',
        buffer: 30,
        req_qual: false,
        qual_title: null,
        specs: { lasers: ['405nm', '488nm', '552nm', '638nm'], detection: 'HyD spectral detectors', objective_lens: '63x / 1.40 Oil' }
      },
      {
        id: '44444444-4444-4444-4444-444444440006',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Universal Robots UR5e 6-DOF Collaborative Robotic Arm',
        model: 'UR5e e-Series',
        manufacturer: 'Universal Robots',
        serial: 'UR-5E-10492',
        asset: 'EQ-ENG-103',
        status: 'AVAILABLE',
        buffer: 20,
        req_qual: false,
        qual_title: null,
        specs: { payload: '5 kg', reach: '850 mm', repeatability: '+/- 0.03 mm', degrees_of_freedom: 6 }
      },
      {
        id: '44444444-4444-4444-4444-444444440007',
        lab_id: '33333333-3333-3333-3333-333333333332',
        name: 'Instron 5969 Dual Column Electromechanical Testing System',
        model: '5969 Tabletop',
        manufacturer: 'Instron',
        serial: 'IN-5969-401',
        asset: 'EQ-MAT-204',
        status: 'AVAILABLE',
        buffer: 30,
        req_qual: false,
        qual_title: null,
        specs: { capacity: '50 kN (11,250 lbf)', test_speed: '0.001 to 1000 mm/min', crosshead_travel: '1140 mm' }
      },
      {
        id: '44444444-4444-4444-4444-444444440008',
        lab_id: '33333333-3333-3333-3333-333333333332',
        name: 'Oxford Instruments PlasmaPro 80 Reactive Ion Etcher',
        model: 'PlasmaPro 80 RIE',
        manufacturer: 'Oxford Instruments',
        serial: 'OX-RIE-9021',
        asset: 'EQ-MAT-205',
        status: 'AVAILABLE',
        buffer: 45,
        req_qual: false,
        qual_title: null,
        specs: { electrode_temp: '-150C to +400C', rf_generator: '300W at 13.56 MHz', vacuum: 'Turbomolecular pumped' }
      },
      {
        id: '44444444-4444-4444-4444-444444440009',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Rohde & Schwarz FSV3030 Signal and Spectrum Analyzer',
        model: 'FSV3030-B10',
        manufacturer: 'Rohde & Schwarz',
        serial: 'RS-FSV-30129',
        asset: 'EQ-ENG-104',
        status: 'AVAILABLE',
        buffer: 15,
        req_qual: false,
        qual_title: null,
        specs: { frequency_range: '10 Hz to 30 GHz', analysis_bandwidth: '200 MHz', phase_noise: '-110 dBc/Hz at 10 kHz' }
      },
      {
        id: '44444444-4444-4444-4444-444444440010',
        lab_id: '33333333-3333-3333-3333-333333333331',
        name: 'Pace ThermoDrive Dual High-Precision Soldering Station',
        model: 'ADS200 Production',
        manufacturer: 'PACE Worldwide',
        serial: 'PC-ADS-99120',
        asset: 'EQ-ENG-105',
        status: 'AVAILABLE',
        buffer: 15,
        req_qual: false,
        qual_title: null,
        specs: { power: '120 W', temp_range: '193C to 454C', channels: 2 }
      }
    ];

    for (const eq of equipmentData) {
      await client.query(`
        INSERT INTO equipment (
          id, laboratory_id, name, model, manufacturer, serial_number, asset_tag, 
          status, requires_qualification, qualification_title, buffer_minutes, technical_specifications
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (serial_number) DO UPDATE SET 
          name = EXCLUDED.name, 
          status = EXCLUDED.status, 
          technical_specifications = EXCLUDED.technical_specifications;
      `, [
        eq.id, eq.lab_id, eq.name, eq.model, eq.manufacturer, eq.serial, eq.asset, 
        eq.status, eq.req_qual, eq.qual_title, eq.buffer, JSON.stringify(eq.specs)
      ]);
    }

    console.log("Seeded 10 instruments successfully.");
    console.log("\n=== Seed complete! Ready for application use. ===");
  } catch (err: any) {
    console.error("Seeding error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSeed().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
