import pandas as pd
import json
import requests
import zipfile
import io

# URL to the zip code dataset from geonames.org
url = 'https://download.geonames.org/export/zip/US.zip'

try:
    print("Downloading zip code data...")
    # Download the file content
    response = requests.get(url)
    response.raise_for_status()  # Will raise an exception for bad status codes

    print("Extracting data from zip archive...")
    # Open the zip file from the in-memory content
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        # Extract the specific file we need (US.txt)
        with z.open('US.txt') as f:
            print("Processing zip code data...")
            # Read the data using pandas
            df = pd.read_csv(f, sep='\t', header=None,
                             names=['country_code', 'postal_code', 'place_name', 'admin_name1', 'admin_code1',
                                    'admin_name2', 'admin_code2', 'admin_name3', 'admin_code3',
                                    'latitude', 'longitude', 'accuracy'])

    print("Filtering for Georgia zip codes...")
    # Filter for Georgia (GA) state
    df_ga = df[df['admin_code1'] == 'GA']

    # Create the dictionary with the required structure
    zip_data = {
        str(row['postal_code']).zfill(5): {
            'lat': row['latitude'],
            'lon': row['longitude']
        }
        for index, row in df_ga.iterrows()
    }

    # Write the data to zip_codes.json
    with open('zip_codes.json', 'w') as f:
        json.dump(zip_data, f, indent=2)

    print(f"Successfully created zip_codes.json with {len(zip_data)} Georgia zip codes.")

except requests.exceptions.RequestException as e:
    print(f"Error downloading the file: {e}")
except Exception as e:
    print(f"An error occurred: {e}")