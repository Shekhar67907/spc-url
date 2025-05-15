import { format } from "date-fns";
import { AnalysisData, SSAnalysis, ProcessInterpretation, InspectionData } from "@/types/spc";

const BASE_URL = "http://10.10.1.7:8304";

const calculateDistributionData = (measurements: number[], lsl: number, usl: number) => {
  // Step 1 & 2: Process Max & Min
  const processMax = Math.max(...measurements);
  const processMin = Math.min(...measurements);
  
  // Step 3: Process Width
  const processWidth = processMax - processMin;
  
  // Step 4: Number of Data Points
  const dataPoints = measurements.length;
  
  // Step 5: Number of Classes (Bins)
  const binCount = Math.ceil(Math.sqrt(dataPoints));
  
  // Step 6: Bin Width
  const binWidth = processWidth / binCount;
  
  // Step A: Bin Start (considering LSL)
  const binStart = Math.min(processMin, lsl);
  
  // Create bins array
  const bins = Array(binCount).fill(0);
  
  // Populate bins
  measurements.forEach(value => {
    // Handle edge case for maximum value
    if (value === processMax) {
      bins[binCount - 1]++;
      return;
    }
    
    const binIndex = Math.floor((value - binStart) / binWidth);
    if (binIndex >= 0 && binIndex < binCount) {
      bins[binIndex]++;
    }
  });

  // Generate bin data with proper x-values (bin centers)
  const data = bins.map((count, i) => ({
    x: Number((binStart + (i * binWidth) + (binWidth / 2)).toFixed(4)),
    y: count
  }));

  return {
    data,
    stats: {
      mean: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      stdDev: Math.sqrt(
        measurements.reduce((a, b) => 
          a + Math.pow(b - (measurements.reduce((c, d) => c + d, 0) / measurements.length), 2), 0
        ) / (measurements.length - 1)
      ),
      target: (usl + lsl) / 2
    },
    numberOfBins: binCount
  };
};


export const analyzeData = async (params: {
  startDate: Date;
  endDate: Date;
  selectedShifts: number[];
  material: string;
  operation: string;
  gauge: string;
}): Promise<AnalysisData | null> => {
  try {
    // Fetch inspection data from API
    const queryParams = new URLSearchParams({
      FromDate: format(params.startDate, "dd/MM/yyyy"),
      ToDate: format(params.endDate, "dd/MM/yyyy"),
      MaterialCode: params.material,
      OperationCode: params.operation,
      GuageCode: params.gauge,
      ShiftId: params.selectedShifts.join(",")
    });

    const response = await fetch(
      `${BASE_URL}/api/productionappservices/getspcpirinspectiondatalist?${queryParams}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch inspection data");
    }

    const inspectionData: InspectionData[] = await response.json();
    
    if (!inspectionData.length) {
      throw new Error("No inspection data available");
    }

    // Validate and extract measurements and specifications
    const validData = inspectionData.filter(d => {
      const actual = parseFloat(d.ActualSpecification);
      const from = parseFloat(d.FromSpecification);
      const to = parseFloat(d.ToSpecification);
      return !isNaN(actual) && !isNaN(from) && !isNaN(to);
    });

    if (!validData.length) {
      throw new Error("No valid measurements found in the data");
    }

    const measurements = validData.map(d => parseFloat(d.ActualSpecification));
    const lsl = parseFloat(validData[0].FromSpecification); // LCL from API
    const usl = parseFloat(validData[0].ToSpecification); // UCL from API
    const target = (lsl + usl) / 2;

    // Validate specification limits
    if (lsl >= usl) {
      throw new Error("Invalid specification limits: LSL must be less than USL");
    }

    // Calculate basic statistics
    const mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const stdDev = Math.sqrt(
      measurements.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (measurements.length - 1)
    );

    // Calculate control chart data
    const xBarData = measurements.map((value, index) => ({
      x: index + 1,
      y: value
    }));

    const rangeData = measurements.slice(1).map((value, index) => ({
      x: index + 1,
      y: Math.abs(value - measurements[index])
    }));

    // Calculate control limits
    const avgRange = rangeData.reduce((a, b) => a + b.y, 0) / rangeData.length;
    const xBarUcl = mean + (2.66 * avgRange);
    const xBarLcl = mean - (2.66 * avgRange);
    const rangeUcl = 3.267 * avgRange;
    const rangeLcl = 0;

    // Calculate process capability indices using actual specification limits
    const safeStdDev = stdDev === 0 ? 0.000001 : stdDev; // Prevent division by zero
    const cp = (usl - lsl) / (6 * safeStdDev);
    const cpu = (usl - mean) / (3 * safeStdDev);
    const cpl = (mean - lsl) / (3 * safeStdDev);
    const cpk = Math.min(cpu, cpl);
    const pp = cp;
    const ppu = cpu;
    const ppl = cpl;
    const ppk = cpk;

    // Calculate distribution data
    const distribution = calculateDistributionData(measurements, lsl, usl);

    // Analyze for special causes
    const pointsOutsideControl = xBarData.filter(point => 
      point.y > xBarUcl || point.y < xBarLcl
    ).length;

    const analysis: AnalysisData = {
      metrics: {
        xBar: Number(mean.toFixed(4)),
        stdDevOverall: Number(stdDev.toFixed(4)),
        stdDevWithin: Number(stdDev.toFixed(4)),
        movingRange: Number(avgRange.toFixed(4)),
        cp: Number(cp.toFixed(2)),
        cpkUpper: Number(cpu.toFixed(2)),
        cpkLower: Number(cpl.toFixed(2)),
        cpk: Number(cpk.toFixed(2)),
        pp: Number(pp.toFixed(2)),
        ppu: Number(ppu.toFixed(2)),
        ppl: Number(ppl.toFixed(2)),
        ppk: Number(ppk.toFixed(2)),
        lsl,
        usl
      },
      controlCharts: {
        xBarData,
        rangeData,
        limits: {
          xBarUcl: Number(xBarUcl.toFixed(4)),
          xBarLcl: Number(xBarLcl.toFixed(4)),
          xBarMean: Number(mean.toFixed(4)),
          rangeUcl: Number(rangeUcl.toFixed(4)),
          rangeLcl: Number(rangeLcl.toFixed(4)),
          rangeMean: Number(avgRange.toFixed(4))
        }
      },
      distribution: {
        data: distribution.data,
        stats: {
          mean: Number(mean.toFixed(4)),
          stdDev: Number(stdDev.toFixed(4)),
          target: Number(target.toFixed(4))
        },
        numberOfBins: distribution.numberOfBins
      },
      ssAnalysis: {
        processShift: cpk < 0.75 * cp ? "Yes" : "No",
        processSpread: cp < 1 ? "Yes" : "No",
        specialCause: pointsOutsideControl > 0 ? "Variation Detected" : "No Special Cause"
      } as SSAnalysis,
      processInterpretation: {
        shortTermCapability: cp >= 1.33 ? "Process meets spec" : "Process needs improvement",
        shortTermCentered: Math.abs(cpu - cpl) < 0.2 ? "Centered" : "Not centered",
        longTermPerformance: cpk >= 1.33 ? "Performance good" : "Performance needs improvement",
        longTermCentered: Math.abs(mean - target) < (0.1 * (usl - lsl)) ? "Centered" : "Not centered"
      } as ProcessInterpretation
    };

    return analysis;
  } catch (error) {
    console.error("Error in analyzeData:", error);
    return null;
  }
};