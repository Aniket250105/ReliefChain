import { Request, Response } from 'express';
import { generateReport, getPublicDashboard } from './analytics.service';

export const getReports = async (req: Request, res: Response) => {
  try {
    const { disasterId, startDate, endDate, format } = req.query;
    
    const report = await generateReport({
      disasterId: disasterId as string,
      startDate: startDate as string,
      endDate: endDate as string
    });

    if (format === 'csv') {
      const headers = ['Campaign ID', 'Campaign Name', 'Disaster ID', 'Disaster Name', 'NGO Name', 'Funds Raised', 'Resources Distributed', 'Beneficiaries Served'];
      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '""';
        const stringified = String(str);
        if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
          return `"${stringified.replace(/"/g, '""')}"`;
        }
        return stringified;
      };

      const rows = report.campaignBreakdown.map(c => [
        escapeCsv(c.campaignId),
        escapeCsv(c.campaignName),
        escapeCsv(c.disasterId),
        escapeCsv(c.disasterName),
        escapeCsv(c.ngoName),
        escapeCsv(c.fundsRaised),
        escapeCsv(c.resourcesDistributed),
        escapeCsv(c.beneficiariesServed)
      ]);

      const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics_report.csv"');
      return res.status(200).send(csvString);
    }

    return res.status(200).json(report);
  } catch (error: any) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const dashboard = await getPublicDashboard();
    return res.status(200).json(dashboard);
  } catch (error: any) {
    console.error('Error fetching public dashboard:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
