CREATE DATABASE IF NOT EXISTS chainiq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'chainiq_user'@'localhost' IDENTIFIED BY 'chainiq_password';

GRANT ALL PRIVILEGES ON `chainiq`.* TO 'chainiq_user'@'localhost';

USE chainiq;

-- ---------------------------------------------------------------------------
-- REFERENCE DATA
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
    category_l1     VARCHAR(100) NOT NULL,
    category_l2     VARCHAR(150) NOT NULL,
    category_description TEXT,
    typical_unit    VARCHAR(100),
    pricing_model   VARCHAR(100) NOT NULL,
    PRIMARY KEY (category_l1, category_l2)
);

-- ---------------------------------------------------------------------------
-- SUPPLIER MASTER
-- Composite PK because one supplier serves multiple categories (one row each).
-- ---------------------------------------------------------------------------

CREATE TABLE suppliers (
    supplier_id             VARCHAR(20)  NOT NULL,
    supplier_name           VARCHAR(200) NOT NULL,
    category_l1             VARCHAR(100) NOT NULL,
    category_l2             VARCHAR(150) NOT NULL,
    country_hq              CHAR(2)      NOT NULL,
    service_regions         VARCHAR(200) NOT NULL COMMENT 'Semicolon-delimited country codes e.g. DE;FR;NL',
    currency                VARCHAR(100) NOT NULL,
    pricing_model           VARCHAR(100) NOT NULL,
    quality_score           TINYINT UNSIGNED NOT NULL,
    risk_score              TINYINT UNSIGNED NOT NULL,
    esg_score               TINYINT UNSIGNED NOT NULL,
    preferred_supplier      TINYINT(1)   NOT NULL DEFAULT 0,
    is_restricted           TINYINT(1)   NOT NULL DEFAULT 0,
    restriction_reason      TEXT,
    contract_status         VARCHAR(100) NOT NULL DEFAULT 'active',
    data_residency_supported TINYINT(1)  NOT NULL DEFAULT 0,
    capacity_per_month      INT UNSIGNED,
    notes                   TEXT,
    PRIMARY KEY (supplier_id, category_l2),
    FOREIGN KEY (category_l1, category_l2) REFERENCES categories (category_l1, category_l2),
    INDEX idx_supplier_id (supplier_id),
    INDEX idx_category    (category_l1, category_l2)
);

-- ---------------------------------------------------------------------------
-- PRICING TIERS
-- One row per (supplier, category, region, quantity band).
-- ---------------------------------------------------------------------------

CREATE TABLE pricing (
    pricing_id              VARCHAR(20)  NOT NULL,
    supplier_id             VARCHAR(20)  NOT NULL,
    category_l1             VARCHAR(100) NOT NULL,
    category_l2             VARCHAR(150) NOT NULL,
    region                  VARCHAR(100) NOT NULL,
    currency                VARCHAR(100) NOT NULL,
    pricing_model           VARCHAR(100) NOT NULL,
    min_quantity            INT          NOT NULL DEFAULT 0,
    max_quantity            INT          NOT NULL,
    unit_price              DECIMAL(14, 4) NOT NULL,
    moq                     INT          NOT NULL DEFAULT 1,
    standard_lead_time_days TINYINT UNSIGNED NOT NULL,
    expedited_lead_time_days TINYINT UNSIGNED,
    expedited_unit_price    DECIMAL(14, 4),
    valid_from              DATE         NOT NULL,
    valid_to                DATE         NOT NULL,
    notes                   TEXT,
    PRIMARY KEY (pricing_id),
    FOREIGN KEY (supplier_id, category_l2) REFERENCES suppliers (supplier_id, category_l2),
    INDEX idx_supplier_category_region (supplier_id, category_l2, region),
    INDEX idx_quantity_band (min_quantity, max_quantity)
);

-- ---------------------------------------------------------------------------
-- HISTORICAL AWARDS
-- Multiple rows per request_id (one per evaluated supplier, ranked 1..N).
-- ---------------------------------------------------------------------------

CREATE TABLE historical_awards (
    award_id                VARCHAR(20)  NOT NULL,
    request_id              VARCHAR(20)  NOT NULL,
    award_date              DATE         NOT NULL,
    category_l1             VARCHAR(100) NOT NULL,
    category_l2             VARCHAR(150) NOT NULL,
    country                 CHAR(2)      NOT NULL,
    business_unit           VARCHAR(100) NOT NULL,
    supplier_id             VARCHAR(20)  NOT NULL,
    supplier_name           VARCHAR(200) NOT NULL,
    total_value             DECIMAL(15, 2) NOT NULL,
    currency                VARCHAR(100) NOT NULL,
    quantity                DECIMAL(14, 2),
    required_by_date        DATE,
    awarded                 TINYINT(1)   NOT NULL DEFAULT 0,
    award_rank              TINYINT UNSIGNED NOT NULL,
    decision_rationale      TEXT,
    policy_compliant        TINYINT(1)   NOT NULL DEFAULT 1,
    preferred_supplier_used TINYINT(1)   NOT NULL DEFAULT 0,
    escalation_required     TINYINT(1)   NOT NULL DEFAULT 0,
    escalated_to            VARCHAR(100),
    savings_pct             DECIMAL(6, 2),
    lead_time_days          TINYINT UNSIGNED,
    risk_score_at_award     TINYINT UNSIGNED,
    notes                   TEXT,
    PRIMARY KEY (award_id),
    INDEX idx_request_id          (request_id),
    INDEX idx_supplier_id         (supplier_id),
    INDEX idx_category            (category_l1, category_l2),
    INDEX idx_country_category    (country, category_l1, category_l2),
    INDEX idx_awarded_rank        (awarded, award_rank)
);

-- ---------------------------------------------------------------------------
-- POLICY: APPROVAL THRESHOLDS
-- Normalised from policies.json; covers EUR, CHF, USD bands.
-- USD entries use field aliases (min_value/max_value) in source — mapped here.
-- max_amount NULL means unbounded upper tier.
-- ---------------------------------------------------------------------------

CREATE TABLE approval_thresholds (
    threshold_id                    VARCHAR(10) NOT NULL,
    currency                        VARCHAR(100) NOT NULL,
    min_amount                      DECIMAL(15, 2) NOT NULL,
    max_amount                      DECIMAL(15, 2),
    min_supplier_quotes             TINYINT UNSIGNED NOT NULL,
    managed_by                      JSON NOT NULL    COMMENT 'Array of roles e.g. ["business","procurement"]',
    deviation_approval_required_from JSON NOT NULL   COMMENT 'Array of approver titles; empty array if none required',
    policy_note                     TEXT            COMMENT 'Free-text note from source (USD entries)',
    PRIMARY KEY (threshold_id),
    INDEX idx_currency_range (currency, min_amount)
);

-- ---------------------------------------------------------------------------
-- POLICY: PREFERRED SUPPLIERS
-- Policy-level designation (source: policies.json preferred_suppliers).
-- Separate from the preferred_supplier flag in suppliers which mirrors CSV data.
-- ---------------------------------------------------------------------------

CREATE TABLE preferred_suppliers (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    supplier_id     VARCHAR(20)  NOT NULL,
    supplier_name   VARCHAR(200) NOT NULL,
    category_l1     VARCHAR(100) NOT NULL,
    category_l2     VARCHAR(150) NOT NULL,
    region_scope    JSON         COMMENT 'Array of region codes e.g. ["EU","CH"]; NULL means global',
    policy_note     TEXT,
    PRIMARY KEY (id),
    UNIQUE KEY uq_supplier_category (supplier_id, category_l1, category_l2),
    INDEX idx_category (category_l1, category_l2)
);

-- ---------------------------------------------------------------------------
-- POLICY: RESTRICTED SUPPLIERS
-- restriction_scope ["all"] means globally restricted for the category.
-- Country-scoped restrictions list specific country codes.
-- ---------------------------------------------------------------------------

CREATE TABLE restricted_suppliers (
    id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    supplier_id         VARCHAR(20)  NOT NULL,
    supplier_name       VARCHAR(200) NOT NULL,
    category_l1         VARCHAR(100) NOT NULL,
    category_l2         VARCHAR(150) NOT NULL,
    restriction_scope   JSON         NOT NULL COMMENT 'Array of country codes or ["all"]',
    restriction_reason  TEXT         NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_supplier_category (supplier_id, category_l1, category_l2),
    INDEX idx_supplier_id (supplier_id)
);

-- ---------------------------------------------------------------------------
-- POLICY: CATEGORY RULES
-- ---------------------------------------------------------------------------

CREATE TABLE category_rules (
    rule_id     VARCHAR(10)  NOT NULL,
    category_l1 VARCHAR(100) NOT NULL,
    category_l2 VARCHAR(150) NOT NULL,
    rule_type   VARCHAR(60)  NOT NULL COMMENT 'e.g. mandatory_comparison, fast_track, security_review',
    rule_text   TEXT         NOT NULL,
    PRIMARY KEY (rule_id),
    INDEX idx_category (category_l1, category_l2)
);

-- ---------------------------------------------------------------------------
-- POLICY: GEOGRAPHY RULES
-- Mixed structure in source: single-country rules (GR-001..004) use country +
-- rule_type + rule_text; regional rules (GR-005..008) use region + countries
-- (JSON array) + rule (mapped to rule_text) + applies_to (JSON array).
-- ---------------------------------------------------------------------------

CREATE TABLE geography_rules (
    rule_id     VARCHAR(10)  NOT NULL,
    country     CHAR(2)      COMMENT 'Set for single-country rules; NULL for regional rules',
    region      VARCHAR(20)  COMMENT 'e.g. Americas, APAC; NULL for single-country rules',
    countries   JSON         COMMENT 'Array of country codes for regional rules',
    rule_type   VARCHAR(60)  COMMENT 'e.g. sovereign_preference, language_support; NULL for regional rules',
    rule_text   TEXT         NOT NULL,
    applies_to  JSON         COMMENT 'Array of category_l1 values; NULL means all categories',
    PRIMARY KEY (rule_id),
    INDEX idx_country (country),
    INDEX idx_region  (region)
);

-- ---------------------------------------------------------------------------
-- POLICY: ESCALATION RULES
-- ER-008 uses escalation_target instead of escalate_to in source — normalised
-- to escalate_to here. applies_to_currencies NULL means rule applies to all.
-- ---------------------------------------------------------------------------

CREATE TABLE escalation_rules (
    rule_id                 VARCHAR(10)  NOT NULL,
    trigger_condition       VARCHAR(200) NOT NULL,
    action                  VARCHAR(200) NOT NULL,
    escalate_to             VARCHAR(200) NOT NULL,
    applies_to_currencies   JSON         COMMENT 'Array of currency codes; NULL means all currencies',
    PRIMARY KEY (rule_id)
);

-- ---------------------------------------------------------------------------
-- REQUESTS
-- Source: requests.json. delivery_countries and scenario_tags stored as JSON.
-- budget_amount and quantity are nullable (missing_info scenario).
-- ---------------------------------------------------------------------------

CREATE TABLE requests (
    request_id                  VARCHAR(20)  NOT NULL,
    created_at                  DATETIME     NOT NULL,
    request_channel             VARCHAR(100) NOT NULL,
    request_language            VARCHAR(100) NOT NULL,
    business_unit               VARCHAR(100) NOT NULL,
    country                     CHAR(2)      NOT NULL,
    site                        VARCHAR(100),
    requester_id                VARCHAR(20),
    requester_role              VARCHAR(100),
    submitted_for_id            VARCHAR(20),
    category_l1                 VARCHAR(100) NOT NULL,
    category_l2                 VARCHAR(150) NOT NULL,
    title                       VARCHAR(300) NOT NULL,
    request_text                TEXT         NOT NULL,
    currency                    VARCHAR(100) NOT NULL,
    budget_amount               DECIMAL(15, 2) COMMENT 'NULL when missing_info scenario',
    quantity                    DECIMAL(14, 2) COMMENT 'NULL when missing_info scenario',
    unit_of_measure             VARCHAR(50),
    required_by_date            DATE,
    preferred_supplier_mentioned VARCHAR(200),
    incumbent_supplier          VARCHAR(200),
    contract_type_requested     VARCHAR(100),
    delivery_countries          JSON         NOT NULL COMMENT 'Array of country codes',
    data_residency_constraint   TINYINT(1)   NOT NULL DEFAULT 0,
    esg_requirement             TINYINT(1)   NOT NULL DEFAULT 0,
    status                      VARCHAR(100) NOT NULL DEFAULT 'new',
    scenario_tags               JSON         NOT NULL COMMENT 'Array of tag strings e.g. ["standard","threshold"]',
    PRIMARY KEY (request_id),
    FOREIGN KEY (category_l1, category_l2) REFERENCES categories (category_l1, category_l2),
    INDEX idx_status       (status),
    INDEX idx_country      (country),
    INDEX idx_category     (category_l1, category_l2),
    INDEX idx_created_at   (created_at)
);
