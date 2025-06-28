import pandas as pd
import json
import os
import numpy as np

# Define the output JSON file and the data directory
JSON_FILE = "data.json"
DATA_DIR = "data"

# Define the core CSV files
SYSTEMS_CSV = os.path.join(DATA_DIR, "SDWA_PUB_WATER_SYSTEMS.csv")
VIOLATIONS_CSV = os.path.join(DATA_DIR, "SDWA_VIOLATIONS_ENFORCEMENT.csv")
GEO_AREAS_CSV = os.path.join(DATA_DIR, "SDWA_GEOGRAPHIC_AREAS.csv")
REF_CODES_CSV = os.path.join(DATA_DIR, "SDWA_REF_CODE_VALUES.csv")

def create_json_data():
    """
    Reads data from core CSV files, processes and merges them,
    and outputs a single data.json file to be loaded into gun.js.
    This version creates array-like objects to ensure unique keys for nested data.
    """
    try:
        print("Reading CSV files...")
        systems_df = pd.read_csv(SYSTEMS_CSV, low_memory=False)
        violations_df = pd.read_csv(VIOLATIONS_CSV, low_memory=False)
        geo_df = pd.read_csv(GEO_AREAS_CSV, low_memory=False)
        ref_codes_df = pd.read_csv(REF_CODES_CSV, low_memory=False)

        print("Processing and merging data...")

        ref_codes_df.set_index('VALUE_CODE', inplace=True)
        ref_codes_dict = ref_codes_df['VALUE_DESCRIPTION'].to_dict()

        violations_df['VIOLATION_NAME'] = violations_df['VIOLATION_CODE'].map(ref_codes_dict)
        violations_df['CONTAMINANT_NAME'] = violations_df['CONTAMINANT_CODE'].map(ref_codes_dict)

        # Replace NaN with None for JSON compatibility
        for df in [systems_df, violations_df, geo_df]:
            df.replace({np.nan: None}, inplace=True)

        # --- Group violations and geo data into OBJECTS with numeric keys ---
        # This avoids issues with non-unique IDs and creates an "array-like object"
        # that gun.js can handle.
        violations_grouped = violations_df.groupby('PWSID').apply(
            lambda x: {i: r for i, r in enumerate(x.to_dict(orient='records'))}
        ).to_dict()
        geo_grouped = geo_df.groupby('PWSID').apply(
            lambda x: {i: r for i, r in enumerate(x.to_dict(orient='records'))}
        ).to_dict()


        # --- Build the final JSON structure ---
        systems_dict = systems_df.to_dict(orient='records')
        
        final_data = {}
        for system in systems_dict:
            pwsid = system.get('PWSID')
            if pwsid:
                system['violations'] = violations_grouped.get(pwsid, {})
                system['geo_areas'] = geo_grouped.get(pwsid, {})
                final_data[pwsid] = system

        print(f"Writing data to {JSON_FILE}...")
        with open(JSON_FILE, 'w') as f:
            json.dump(final_data, f, indent=2)

        print(f"Successfully created {JSON_FILE} with {len(final_data)} water systems.")

    except FileNotFoundError as e:
        print(f"Error: {e}. Make sure you are in the project root directory.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    create_json_data()