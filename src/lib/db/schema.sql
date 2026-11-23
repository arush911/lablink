-- ==============================================================================
-- LabLink 2026 - PostgreSQL 18.4 Complete Database Schema Migration
-- ==============================================================================

-- 1. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    building TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users (Student & Faculty Roles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'faculty')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    student_id_number VARCHAR(50),
    optional_qualification VARCHAR(100),
    monthly_quota_hours DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    used_quota_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 4. Laboratories
CREATE TABLE IF NOT EXISTS laboratories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    room_location VARCHAR(50) NOT NULL,
    coordinator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    cancellation_buffer_minutes INT NOT NULL DEFAULT 120,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Laboratory Operating Hours
CREATE TABLE IF NOT EXISTS laboratory_operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TIME NOT NULL DEFAULT '08:00:00',
    close_time TIME NOT NULL DEFAULT '20:00:00',
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unique_lab_day UNIQUE(laboratory_id, day_of_week),
    CONSTRAINT check_valid_hours CHECK (close_time > open_time)
);

-- 6. Equipment
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    laboratory_id UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    model VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    asset_tag VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OFFLINE')),
    requires_qualification BOOLEAN NOT NULL DEFAULT FALSE,
    qualification_title VARCHAR(100),
    buffer_minutes INT NOT NULL DEFAULT 15,
    technical_specifications JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_lab ON equipment(laboratory_id);

-- 7. Equipment Capabilities
CREATE TABLE IF NOT EXISTS equipment_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    capability_name VARCHAR(150) NOT NULL,
    description TEXT,
    parameter_range VARCHAR(100)
);

-- 8. Booking Requests (Docket Pipeline)
CREATE TABLE IF NOT EXISTS booking_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_number VARCHAR(50) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'BOOKED', 'CANCELLED')),
    requested_duration_hours DECIMAL(4,2) NOT NULL CHECK (requested_duration_hours >= 0.5 AND requested_duration_hours <= 12.0),
    project_deadline DATE,
    preferred_window_start TIMESTAMPTZ,
    preferred_window_end TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_requests_student ON booking_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_faculty ON booking_requests(faculty_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);

-- 9. Project Details
CREATE TABLE IF NOT EXISTS project_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_request_id UUID UNIQUE NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
    project_title VARCHAR(255) NOT NULL,
    abstract TEXT NOT NULL,
    course_code VARCHAR(50),
    grant_code VARCHAR(100),
    hazardous_materials_declared BOOLEAN NOT NULL DEFAULT FALSE,
    safety_notes TEXT
);

-- 10. Bookings (With Generated tstzrange and GiST Exclusion Constraint)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id VARCHAR(50) UNIQUE NOT NULL,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    confirmed_by_faculty_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    booking_request_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    time_range TSTZRANGE GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_booking_positive_duration CHECK (end_time > start_time),
    CONSTRAINT check_booking_duration_bounds CHECK (end_time - start_time BETWEEN INTERVAL '30 minutes' AND INTERVAL '12 hours'),
    CONSTRAINT no_overlapping_confirmed_bookings EXCLUDE USING gist (
        equipment_id WITH =,
        time_range WITH &&
    ) WHERE (status = 'CONFIRMED')
);

CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_equipment ON bookings(equipment_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- 11. Booking Audit Logs (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS booking_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    request_id UUID REFERENCES booking_requests(id) ON DELETE SET NULL,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(50) NOT NULL,
    reason_or_justification TEXT NOT NULL,
    state_snapshot JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_booking ON booking_audit_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON booking_audit_logs(actor_id);

-- 12. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    reference_entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
