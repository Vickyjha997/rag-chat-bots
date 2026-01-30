// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FeeCurrency {
    code?: string;
  }
  
  interface Fee {
    amount?: number | string;
    currency?: FeeCurrency;
  }
  
  interface Program {
    name?: string;
  }
  
  interface MicrositeSection {
    custom_domain?: string;
  }
  
  interface MediaSection {
    brochure_url?: string;
  }
  
  interface OverviewSection {
    description?: string;
  }
  
  interface BenefitsItem {
    title?: string;
    description?: string;
  }
  
  interface BenefitsSection {
    benefits_items?: BenefitsItem[];
  }
  
  interface WhoShouldApplySection {
    description?: string;
  }
  
  interface CertificationSection {
    bottom_description?: string;
  }
  
  interface GenericSection {
    title?: string;
    description?: string;
  }
  
  interface SessionObjective {
    description?: string;
  }
  
  interface Session {
    title?: string;
    overview?: string;
    objectives?: SessionObjective[];
  }
  
  interface CurriculumTheme {
    title?: string;
    overview?: string;
    sessions?: Session[];
  }
  
  interface DesignCurriculumSection {
    title?: string;
    top_description?: string;
    bottom_description?: string;
    items?: CurriculumTheme[];
  }
  
  interface AcademicPartner {
    display_name?: string;
  }
  
  interface Faculty {
    name?: string;
    title?: string;
    academic_partner?: AcademicPartner;
    description?: string;
  }
  
  interface FacultyItem {
    faculty?: Faculty;
  }
  
  interface FacultySection {
    items?: FacultyItem[];
  }
  
  interface IndustryExpertsSection {
    items?: FacultyItem[];
  }
  
  interface Owner {
    name?: string;
    email?: string;
  }
  
  interface CohortData {
    id?: string;
    cohort_key?: string;
    name?: string;
    program?: Program;
    status?: string;
    start_date?: string;
    end_date?: string;
    duration?: string;
    format?: string;
    location?: string;
    fees?: Fee[];
    microsite_section?: MicrositeSection;
    media_section?: MediaSection;
    overview_section?: OverviewSection;
    benefits_section?: BenefitsSection;
    who_should_apply_section?: WhoShouldApplySection;
    certification_section?: CertificationSection;
    generic_sections?: GenericSection[];
    design_curriculum_section?: DesignCurriculumSection;
    faculty_section?: FacultySection;
    industry_experts_section?: IndustryExpertsSection;
    owner?: Owner;
  }
  
  export interface CohortJson {
    data?: CohortData;
  }
  
  interface FeeInfo {
    feeAmount: number | string | null;
    feeCurrency: string | null;
  }
  
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Remove HTML tags + decode common entities
   */
  export function stripHtml(html: unknown): string {
    if (!html) return "";
    return String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }
  
  /**
   * Utility: title helpers
   */
  function toDateOnly(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    // Keep it simple: ISO date -> YYYY-MM-DD
    if (typeof dateStr === "string" && dateStr.includes("T")) {
      return dateStr.split("T")[0];
    }
    return dateStr;
  }
  
  /**
   * Extract fee info
   */
  function extractFee(data: CohortData): FeeInfo {
    if (!data?.fees || !Array.isArray(data.fees) || data.fees.length === 0)
      return { feeAmount: null, feeCurrency: null };
  
    const fee = data.fees[0];
    return {
      feeAmount: fee?.amount ?? null,
      feeCurrency: fee?.currency?.code ?? null,
    };
  }
  
  /**
   * Main: Convert cohort JSON object -> clean text string
   */
  export function cohortJsonToText(cohortJson: CohortJson): string {
    const d = cohortJson?.data;
    if (!d) throw new Error("Missing cohort data");
  
    const parts: string[] = [];
  
    const push = (title: string, content?: unknown) => {
      if (!content) return;
      const clean = stripHtml(content);
      if (clean) parts.push(`## ${title}\n${clean}`);
    };
  
    // ================= METADATA =================
  
    parts.push(`## Cohort Info
  Cohort Name: ${d.name}
  Program: ${d.program?.name}
  Duration: ${d.duration}
  Format: ${d.format}
  Location: ${d.location}
  Start Date: ${toDateOnly(d.start_date)}
  End Date: ${toDateOnly(d.end_date)}
  `);
  
    const fee = extractFee(d);
    if (fee.feeAmount)
      parts.push(`## Fee\n${fee.feeAmount} ${fee.feeCurrency ?? ""}`);
  
    // ================= OVERVIEW =================
  
    push("Program Overview", d.overview_section?.description);
  
    // ================= BENEFITS =================
  
    if (d.benefits_section?.benefits_items?.length) {
      const benefits = d.benefits_section.benefits_items
        .map(b => `• ${stripHtml(b.title)}`)
        .join("\n");
  
      parts.push(`## Key Benefits\n${benefits}`);
    }
  
    // ================= WHO SHOULD APPLY =================
  
    push("Who Should Apply", d.who_should_apply_section?.description);
  
    // ================= CURRICULUM =================
  
    if (d.design_curriculum_section?.items) {
      parts.push(`## Curriculum`);
  
      d.design_curriculum_section.items.forEach(theme => {
        if (!theme.title) return;
  
        parts.push(`### Theme: ${theme.title}`);
  
        if (theme.overview)
          parts.push(stripHtml(theme.overview));
  
        theme.sessions?.forEach(session => {
          parts.push(`#### Session: ${session.title}`);
          if (session.overview) parts.push(stripHtml(session.overview));
        });
      });
    }
  
    // ================= FACULTY =================
  
    if (d.faculty_section?.items?.length) {
      parts.push(`## Faculty`);
  
      d.faculty_section.items.forEach(item => {
        const f = item.faculty;
        if (!f) return;
  
        parts.push(`### ${f.name}`);
        if (f.title) parts.push(f.title);
        if (f.description) parts.push(stripHtml(f.description));
      });
    }
  
    // ================= INDUSTRY EXPERTS =================
  
    if (d.industry_experts_section?.items?.length) {
      parts.push(`## Industry Experts`);
  
      d.industry_experts_section.items.forEach(item => {
        const e = item.faculty;
        if (!e) return;
  
        parts.push(`### ${e.name}`);
        if (e.title) parts.push(e.title);
        if (e.description) parts.push(stripHtml(e.description));
      });
    }
  
    return parts.join("\n\n");
  }
  
  