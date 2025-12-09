
-- Add new fields to projects table
ALTER TABLE projects 
ADD COLUMN ridging_crew_nos TEXT,
ADD COLUMN mode_of_contract TEXT,
ADD COLUMN working_hours TEXT,
ADD COLUMN ppe TEXT,
ADD COLUMN additional_field_1_title TEXT,
ADD COLUMN additional_field_1_description TEXT,
ADD COLUMN additional_field_2_title TEXT,
ADD COLUMN additional_field_2_description TEXT,
ADD COLUMN additional_field_3_title TEXT,
ADD COLUMN additional_field_3_description TEXT;
