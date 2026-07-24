// Helper function to parse and clean project data from multipart/form-data
export const parseProjectDataFromFormData = (body: any) => {
  const data = { ...body };

  // Handle date strings from FormData
  ["startDate", "plannedEndDate", "actualEndDate"].forEach((dateKey) => {
    if (data[dateKey] && typeof data[dateKey] === "string") {
      const date = new Date(data[dateKey]);
      if (!isNaN(date.getTime())) {
        data[dateKey] = date;
      } else {
        delete data[dateKey];
      }
    }
  });

  // Handle potential number strings
  if (data.customerId && typeof data.customerId === "string") {
    const num = parseInt(data.customerId, 10);
    if (!isNaN(num)) data.customerId = num;
  }

  if (data.locations && typeof data.locations === "string") {
    try {
      data.locations = JSON.parse(data.locations);
    } catch (e) {
      data.locations = [data.locations];
    }
  }

  if (data.workRemainingDays && typeof data.workRemainingDays === "string") {
    try {
      data.workRemainingDays = JSON.parse(data.workRemainingDays);
    } catch (e) {
      data.workRemainingDays = [];
    }
  }

  // Clean up empty/nullish string values from FormData
  const ambientFields = [
    "surfaceTemperature",
    "airTemperature",
    "relativeHumidity",
    "dewPointTemperature",
    "dewPointSurfaceDiff",
  ];

  Object.keys(data).forEach((key) => {
    if (data[key] === "null" || data[key] === "undefined") {
      delete data[key];
    } else if (data[key] === "") {
      if (key.startsWith("additionalField") || ambientFields.includes(key)) {
        // Explicitly set to null so the database clears the value
        data[key] = null;
      } else {
        delete data[key];
      }
    }
  });

  return data;
};
