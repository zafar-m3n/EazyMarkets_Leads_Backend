const { Op, literal } = require("sequelize");
const { Lead, LeadStatus, LeadSource, LeadAssignment, User } = require("../models");
const { resSuccess, resError } = require("../utils/responseUtil");

const LATEST_ASSIGNMENT_IDS = literal(`(SELECT MAX(id) FROM lead_assignments GROUP BY lead_id)`);

function buildExportQueryParts(req) {
  const { status_ids, source_ids, assignee_ids } =
    req.body?.filters && typeof req.body.filters === "object" ? req.body.filters : req.body || {};

  const where = {};

  if (status_ids) {
    const ids = String(status_ids)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) where.status_id = { [Op.in]: ids };
  }

  if (source_ids) {
    const ids = String(source_ids)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) where.source_id = { [Op.in]: ids };
  }

  const parsedAssigneeIds = assignee_ids
    ? String(assignee_ids)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter(Boolean)
    : [];

  const assignmentWhere = { id: { [Op.in]: LATEST_ASSIGNMENT_IDS } };

  if (parsedAssigneeIds.length > 0) {
    assignmentWhere.assignee_id = { [Op.in]: parsedAssigneeIds };
  }

  const include = [
    { model: LeadStatus, attributes: ["id", "value", "label"] },
    { model: LeadSource, attributes: ["id", "value", "label"] },
    {
      model: LeadAssignment,
      as: "LeadAssignments",
      required: parsedAssigneeIds.length > 0,
      where: assignmentWhere,
      include: [{ model: User, as: "assignee", attributes: ["id", "full_name"] }],
    },
  ];

  return { where, include };
}

const CSV_DELIM = ",";
const CRLF = "\r\n";

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s === "") return "";
  const needsQuote = /[",\r\n]/.test(s);
  const safe = s.replace(/"/g, '""');
  return needsQuote ? `"${safe}"` : safe;
}

function writeCsvHeader(res) {
  const header =
    ["first_name", "last_name", "company", "email", "phone", "country", "status", "source", "agent"].join(CSV_DELIM) +
    CRLF;

  res.write("\uFEFF" + header);
}

function leadToCsvRow(l) {
  const cells = [
    csvEscape(l.first_name || ""),
    csvEscape(l.last_name || ""),
    csvEscape(l.company || ""),
    csvEscape(l.email || ""),
    csvEscape(l.phone || ""),
    csvEscape(l.country || ""),
    csvEscape(l?.LeadStatus?.label || ""),
    csvEscape(l?.LeadSource?.label || ""),
    csvEscape(l?.LeadAssignments?.[0]?.assignee?.full_name || ""),
  ];
  return cells.join(CSV_DELIM) + CRLF;
}

const exportCount = async (req, res) => {
  try {
    const { where, include } = buildExportQueryParts(req);

    const { count } = await Lead.findAndCountAll({
      where,
      include,
      distinct: true,
      col: "id",
      limit: 1,
    });

    return resSuccess(res, { count });
  } catch (err) {
    console.error("ExportCount Error:", err);
    return resError(res, "Failed to get export count", 500);
  }
};

const exportDownload = async (req, res) => {
  try {
    const { where, include } = buildExportQueryParts(req);

    const { count } = await Lead.findAndCountAll({
      where,
      include,
      distinct: true,
      col: "id",
      limit: 1,
    });

    if (!count) return resSuccess(res, { message: "No leads match the filters", rows: 0 });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fname = `leads_export_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);

    writeCsvHeader(res);

    const PAGE_SIZE = 5000;
    let offset = 0;

    while (true) {
      const rows = await Lead.findAll({
        where,
        include,
        limit: PAGE_SIZE,
        offset,
        attributes: ["id", "first_name", "last_name", "company", "email", "phone", "country", "status_id", "source_id"],
      });

      if (!rows.length) break;

      for (const l of rows) {
        res.write(leadToCsvRow(l));
      }

      offset += PAGE_SIZE;
    }

    res.end();
  } catch (err) {
    console.error("ExportDownload Error:", err);
    if (!res.headersSent) {
      return resError(res, "Failed to generate export", 500);
    } else {
      try {
        res.end();
      } catch (_) {}
    }
  }
};

module.exports = { exportCount, exportDownload };
