--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--

CREATE TABLE public.settings
(
    param character varying(100) NOT NULL,
    value text,
    CONSTRAINT settings_pkey PRIMARY KEY (param)
)
WITH (OIDS = FALSE);

ALTER TABLE public.settings OWNER to postgres;

--

CREATE TABLE public.calc_stat
(
    date date NOT NULL,
    state smallint NOT NULL,
    department uuid NOT NULL,
    doc uuid NOT NULL,
    nom uuid NOT NULL,
    sys uuid NOT NULL,
    quantity money,
    s money,
    amount money,
    CONSTRAINT calc_stat_pkey PRIMARY KEY (date, state, department, doc, nom, sys)
)
WITH (OIDS = FALSE);

ALTER TABLE public.calc_stat OWNER to postgres;
