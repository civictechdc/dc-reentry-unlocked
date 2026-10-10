/**
 * Offline profile of the source spreadsheet used to design the synthetic-data
 * generator.
 *
 * Analyzed offline on 2026-10-10 with a CSV-aware parser (Python `csv`
 * module); no network access and no execution of spreadsheet content.
 *
 * This file contains four kinds of reviewed constants:
 * 1. `CSV_PROVIDER_NAMES` — the deduplicated provider column, embedded for the
 *    generator to sample from.
 * 2. Raw-value normalization tables — every distinct raw value in the four
 *    categorical columns, its approved normalized value(s), its row frequency,
 *    and a `flag` on rows whose mapping still carries a caveat. The mappings
 *    were APPROVED by the owner on 2026-10-10.
 * 3. `DC_ADDRESS_POOL` — 55 real D.C. street addresses for the generator to
 *    sample from (see the provenance note on the constant).
 * 4. Final approved generation weights used by `generate.ts`.
 *
 * Nothing in this file executes spreadsheet data; it is static documentation
 * embedded as typed constants.
 */

/** One raw spreadsheet value and its approved normalization. */
export interface RawValueMapping {
  /** Exact trimmed raw cell text (empty string = blank cell). */
  readonly raw: string
  /** Approved normalized value(s). Multi-category rows list several; ward tables use numbers. */
  readonly normalized: readonly (string | number)[]
  /** Number of CSV rows carrying this raw value. */
  readonly rows: number
  /** Present only when the mapping still carries a caveat worth recording. */
  readonly flag?: string
}
/**
 * Deduplicated, trimmed provider names from the CSV column
 * "Housing Provider / Organization" (234 distinct names across 935 rows; the
 * first header cell carries a UTF-8 BOM, which the parser strips). Order is
 * first-appearance order in the CSV.
 */
export const CSV_PROVIDER_NAMES: readonly string[] = [
  'So Others Might Eat (SOME)',
  'DC Department of Human Services (DHS)',
  'N Street Village',
  'Community of Hope',
  'House of Ruth',
  'Sasha Bruce Youthwork',
  'Open Arms Housing',
  'Open Arms Housing; The Michaels Organization; Ainger Place Development Corporation',
  'Open Arms Housing; District of Columbia Housing Authority; The Michaels Corporation; The Warrenton Group',
  'Pathways to Housing DC',
  'Miriam\'s Kitchen',
  'Community Connections',
  'Friendship Place',
  'Catholic Charities of the Archdiocese of Washington',
  'Housing Up',
  'DC Housing Authority (DCHA)',
  'Everyone Home DC',
  'DC Doors',
  'Jobs Have Priority, Inc.',
  'Calvary Women\'s Services',
  'New Endeavors by Women',
  'Christ House',
  'Samaritan Inns',
  'Thrive Housing Services',
  'Covenant House Washington',
  'Wanda Alston Foundation',
  'Woodley House',
  'Access Housing',
  'District Alliance for Safe Housing (DASH)',
  'My Sister\'s Place',
  'Salvation Army',
  'United Planning Organization (UPO)',
  'KCCS Inc.',
  'Jaydot',
  'Jaydot / HELP USA',
  'Jaydot / Community Solutions',
  'Jaydot / Housing Up',
  'Jaydot / Recovery Cafe DC',
  'Jaydot / Flaherty & Collins',
  'Metropolitan Educational Solutions',
  'Wheeler Creek Community Development Corporation',
  'DC Health / HOPWA',
  'Homes for Hope',
  'Community Family Life Services (CFLS)',
  'Joseph\'s House',
  'DC Health / CDC',
  'Housing Counseling Services, Inc.',
  'MBI Health Services, LLC',
  'CORE DC',
  'Anacostia Economic Development Corporation (AEDC)',
  'Mary\'s House for Older Adults, DC',
  'Jubilee Housing',
  'Echelon Community Services',
  'SMYAL',
  'SMYAL in partnership with the DC Department of Health',
  'Efforts From Ex-Convicts, Incorporated Of Washington, DC',
  'Edgewood Brookland Family Support Collaborative',
  'Latin American Youth Center (LAYC)',
  'SAMU First Response',
  'Zoe\'s Doors',
  'Healthy Babies',
  'Elizabeth House',
  'Capitol Hill Group Ministry',
  'Virginia Williams Family Resource Center',
  'Father McKenna Center',
  'DC Safe Haven',
  'Clean & Sober Streets',
  'DC Department of Housing and Community Development (DHCD)',
  'Phyllis Wheatley YWCA',
  'Missionaries of Charity, Queen of Peace',
  'Hope and a Home, Inc.',
  'Courtney’s House',
  'Different Avenues',
  'DC Coalition for the Homeless',
  'KBEC Group, Inc.',
  'Faith United Church of Christ (hypothermia partner site)',
  'Central Union Mission',
  'National Center for Children and Families (NCCF)',
  'The Community Partnership for the Prevention of Homelessness (TCP)',
  'Bread for the City',
  'DowntownDC Business Improvement District',
  'McClendon Center',
  'U.S. Department of Veterans Affairs / Washington DC VA Medical Center',
  'U.S.VETS',
  'River East Management',
  'Vesta Corporation',
  'JAG Management Company',
  'AIR Communities (AIR Property Management TRS, LLC)',
  'Keener Management',
  'WC Smith',
  'Somerset Development Company',
  'Taylor Adams Associates (with DC partners)',
  'Gilbane Development Company (with DC partners)',
  'Gilbane Development Company',
  'Telesis Corporation',
  'NHP Foundation',
  'Wesley Housing',
  'Mi Casa, Inc.',
  'MANNA, Inc.',
  'Enterprise Community Development',
  'Community Preservation and Development Corporation (CPDC)',
  'Standard Communities / Housing on Merit',
  'NHT Communities / National Housing Trust',
  'Menkiti Group',
  'Lydia\'s House in Southeast',
  'Habitat for Humanity of Washington, D.C. & Northern Virginia',
  'Paradigm Companies',
  'Horning (Horning Brothers)',
  'A&W Management (awmanage.com)',
  'DC Department of Housing and Community Development (DHCD) / MyHousingSearch',
  'Coalition for Nonprofit Housing & Economic Development (The Coalition) / DC Department of Human Services',
  'New Lease on Life DC (District initiative with DowntownDC BID and CNHED)',
  'Thrive DC',
  'Thompson-Markward Hall (TMH)',
  'Sasha Bruce Youthwork, in partnership with First Congregational United Church of Christ and the Downtown Business Improvement District',
  'Mary House',
  'The Palisades House',
  'ARDAN COMMUNITY LIVING',
  'Verve Behavioral Health',
  'Bruce Love Sober Living',
  'Reynolds and Associates, Inc.',
  'St. Mary’s Court Housing Development Corporation',
  'District of Columbia; administering organization not separately named',
  'DC/Partnership funded',
  'Community for Creative Non-Violence (CCNV)',
  'Adams Place',
  'New York Avenue Shelter',
  'Emery House',
  'Nativity Shelter',
  'Virginia Williams Family Resource Center (FRC)',
  'Safe Haven Outreach Ministry',
  'Salvation Army – Harbor Light Center',
  '801-East Men\'s Shelter',
  'New York Ave Emergency Men\'s Shelter',
  'Georgetown Ministry Center',
  'Harriet Tubman Emergency Women\'s Shelter and Day Program',
  'Nativity Shelter for Women',
  'Open Door',
  'John L. Young Women\'s Center',
  'Harriet Tubman Emergency Women\'s Shelter',
  'Shelter Hotline',
  'Hannah House',
  'Coalition for the Homeless',
  'Mayor\'s Office on Returning Citizen Affairs (MORCA)',
  'Sinai House',
  'Coalition For The Homeless, Inc.',
  'Mary House, Inc.',
  'Holy Comforter St Cyprian Community Action Group',
  'Marshall Heights Community Development Organization',
  'Nazarene Outpost Ministries',
  'Oxford House',
  'La Casa Transitional Rehabilitation Center',
  'Fairview',
  'Hope Village',
  'RAP, Inc.',
  'Woodley House, Inc.',
  'La Casa Transitional Program',
  'Valley Place Family Transitional Program',
  'Webster House',
  'Park Road House',
  'Spring Road Family Program',
  'East of the River Clergy-Police Community Partnership (ERCPCP)',
  'Emery Shelter',
  'Gift of Peace, Missionaries of Charity',
  'Good Hope House',
  'New Beginning',
  'Transgender Health Empowerment',
  'Willis Green Manor',
  'Building Futures',
  'Families Forward',
  'St. Matthias Mulumba House',
  'D.C. Housing Authority (DCHA)',
  'John L. Young Women’s Center',
  'Hermano Pedro Day Shelter',
  'Bethany Women’s Center',
  'Rachel’s Women’s Center',
  'Charlie’s Place',
  'Shirley’s Place / Capitol Hill Group Ministry',
  'HERS',
  'The Summit at St. Martin’s',
  'Lighthouse Center for Healing',
  'Green Door',
  'Anchor Mental Health',
  'Careco',
  'Holly House',
  'Clean and Sober Streets',
  'Camille’s Place',
  'Our Place, DC',
  'Unity Healthcare',
  'LIFT',
  'Landlord-Tenant Resource Center',
  'Housing Management Administration',
  'Housing Customer Service Center, Rental Accommodations and Conversion Division (RACD)',
  'Missionaries of Charity',
  'Bethany, Inc.',
  'Mt. Carmel House',
  'Dorothy Day House',
  'Court Services and Offender Supervision Agency (CSOSA)',
  'District of Columbia Department of Corrections (DOC)',
  'READY Center',
  'Permanent Supportive Housing (PSH)',
  'DC Interagency Council on Homelessness (ICH)',
  'District-sponsored shelters',
  'Homeless shelters',
  'Halfway houses / residential reentry centers (RRCs)',
  'Transitional housing programs',
  'Public housing',
  'Housing Choice Voucher Program',
  'District of Columbia Department of Housing and Community Development / housing organizations',
  'Single Room Occupancy Program',
  'Amazing Gospel Souls, Inc.',
  'Reentry Action Network',
  'Voices for a Second Chance',
  'Collaborative Solutions for Communities',
  'Catholic Charities – 801 East Men’s Shelter',
  'Catholic Charities – New York Avenue Shelter',
  'Downtown Day Services Center',
  'Efforts From Ex-Convicts, Incorporated Of Washington, DC (EFEC)',
  'Friendship Place Welcome Center',
  'Mickey Leland House',
  'University of Legal Services (ULS); Disability Rights DC (DRDC); DC Jail and Prison Advocacy Project (JPAP)',
  'Extended House',
  'University of Services (ULS); Disability Rights DC (DRDC); DC Jail and Prison Advocacy Project (JPAP)',
  'Hope Reentry Network DC',
  'The Prospect House',
  'DH RISTORE',
  'Heart and Home',
  'The National Reentry Network',
  'Project Reconnect',
  'Who Speaks for Me?',
  'Missionaries of Charity – Gift of Peace',
  'SSVF – Veteran Housing (Multiple Providers)',
  'Criminal Justice Coordinating Council for the District of Columbia (CJCC)',
  'Public Defender Service for the District of Columbia (PDS)',
] as const

/** Every distinct raw value in the CSV column "Type of Housing" mapped to one or
 * more HousingCategory values, with row frequency. Long descriptive values
 * that name no recognizable housing type map to other-unknown. */
export const HOUSING_TYPE_MAPPING: readonly RawValueMapping[] = [
  { raw: 'Public housing / deeply subsidized apartments', normalized: ['rental-assistance', 'public-housing'], rows: 55 },
  { raw: 'permanent supportive housing', normalized: ['permanent-supportive'], rows: 52 },
  { raw: 'transitional', normalized: ['transitional'], rows: 51 },
  { raw: 'Not publicly listed', normalized: ['other-unknown'], rows: 34 },
  { raw: 'Transitional housing', normalized: ['transitional'], rows: 33 },
  { raw: 'affordable rental', normalized: ['affordable-rental'], rows: 27 },
  { raw: 'housing navigation', normalized: ['housing-navigation'], rows: 20 },
  { raw: 'Market-rate rental apartments in historic buildings', normalized: ['market-rate'], rows: 16 },
  { raw: 'Privately owned/managed rental apartments (program-eligible and market-rate)', normalized: ['market-rate'], rows: 16, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'emergency shelter', normalized: ['emergency-shelter'], rows: 15 },
  { raw: 'Permanent supportive housing', normalized: ['permanent-supportive'], rows: 14 },
  { raw: 'Deeply affordable rental apartments (nonprofit-owned)', normalized: ['affordable-rental'], rows: 12 },
  { raw: 'Housing program', normalized: ['other-unknown'], rows: 12 },
  { raw: 'LIHTC / tax-credit affordable apartments', normalized: ['affordable-rental'], rows: 11 },
  { raw: 'Shelter (Overnight)', normalized: ['emergency-shelter'], rows: 11 },
  { raw: 'Permanent Supportive Housing', normalized: ['permanent-supportive'], rows: 10 },
  { raw: 'Shelter', normalized: ['emergency-shelter'], rows: 10 },
  { raw: 'rapid rehousing', normalized: ['rapid-rehousing'], rows: 10 },
  { raw: 'rental assistance', normalized: ['rental-assistance'], rows: 10 },
  { raw: 'Affordable rental apartments', normalized: ['affordable-rental'], rows: 9 },
  { raw: 'Overnight emergency shelter', normalized: ['emergency-shelter'], rows: 9 },
  { raw: 'Self-run, self-supported recovery house / sober house', normalized: ['recovery-sober'], rows: 9, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'homelessness prevention', normalized: ['homelessness-prevention'], rows: 9 },
  { raw: 'Emergency low-barrier shelter', normalized: ['emergency-shelter'], rows: 8 },
  { raw: 'Emergency shelter', normalized: ['emergency-shelter'], rows: 8 },
  { raw: 'Hypothermia / overflow shelter', normalized: ['emergency-shelter'], rows: 8 },
  { raw: 'Short-term family housing (emergency)', normalized: ['emergency-shelter'], rows: 8 },
  { raw: 'Transitional Housing', normalized: ['transitional'], rows: 7 },
  { raw: 'Housing assistance', normalized: ['other-unknown'], rows: 6 },
  { raw: 'Emergency shelter and transitional housing', normalized: ['transitional', 'emergency-shelter'], rows: 5 },
  { raw: 'Low-barrier shelter', normalized: ['emergency-shelter'], rows: 5 },
  { raw: 'Affordable / income-restricted apartment community (privately managed)', normalized: ['affordable-rental'], rows: 4 },
  { raw: 'Apartments', normalized: ['other-unknown'], rows: 4 },
  { raw: 'Family housing', normalized: ['other-unknown'], rows: 4 },
  { raw: 'Market-rate/mixed-income multifamily rental apartments', normalized: ['affordable-rental', 'market-rate'], rows: 4 },
  { raw: 'SRO/shared housing', normalized: ['sro'], rows: 4, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Self-run, self-supporting, drug-free recovery house', normalized: ['recovery-sober'], rows: 4, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Single Room Occupancy (SRO)', normalized: ['sro'], rows: 4 },
  { raw: 'Addiction treatment and recovery transitional housing', normalized: ['transitional', 'recovery-sober'], rows: 3 },
  { raw: 'Affordable apartments', normalized: ['affordable-rental'], rows: 3 },
  { raw: 'Affordable housing apartments', normalized: ['affordable-rental'], rows: 3 },
  { raw: 'Affordable permanent housing', normalized: ['affordable-rental'], rows: 3 },
  { raw: 'Affordable senior apartments', normalized: ['affordable-rental'], rows: 3 },
  { raw: 'Day shelter / day center', normalized: ['emergency-shelter'], rows: 3 },
  { raw: 'Domestic violence emergency shelter; safe location', normalized: ['emergency-shelter'], rows: 3, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Domestic violence safe housing', normalized: ['other-unknown'], rows: 3 },
  { raw: 'Family transitional housing', normalized: ['transitional'], rows: 3 },
  { raw: 'Housing and supportive services', normalized: ['other-unknown'], rows: 3 },
  { raw: 'Housing referral and support services', normalized: ['housing-navigation'], rows: 3, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Independent living housing', normalized: ['other-unknown'], rows: 3 },
  { raw: 'Independent-living program', normalized: ['other-unknown'], rows: 3 },
  { raw: 'LIHTC affordable apartments', normalized: ['affordable-rental'], rows: 3 },
  { raw: 'Low-barrier emergency shelter', normalized: ['emergency-shelter'], rows: 3 },
  { raw: 'Male transitional sober house; democratically run, self-supporting and drug-free home', normalized: ['transitional'], rows: 3, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Market-rate multifamily rental apartments', normalized: ['market-rate'], rows: 3 },
  { raw: 'Preserved affordable apartments', normalized: ['affordable-rental'], rows: 3 },
  { raw: 'Public housing and housing vouchers', normalized: ['rental-assistance', 'public-housing'], rows: 3 },
  { raw: 'SRO', normalized: ['sro'], rows: 3 },
  { raw: 'Shelter (Temporary)', normalized: ['emergency-shelter'], rows: 3 },
  { raw: 'Shelter (Temporary; safe location)', normalized: ['emergency-shelter'], rows: 3, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Short-Term Family Housing; emergency shelter', normalized: ['emergency-shelter'], rows: 3, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Supported independent living', normalized: ['other-unknown'], rows: 3 },
  { raw: 'affordable rental; permanent supportive housing', normalized: ['permanent-supportive', 'affordable-rental'], rows: 3 },
  { raw: 'permanent supportive housing / affordable rental', normalized: ['permanent-supportive', 'affordable-rental'], rows: 3 },
  { raw: 'transitional housing', normalized: ['transitional'], rows: 3 },
  { raw: 'Affordable garden-style apartments', normalized: ['affordable-rental'], rows: 2 },
  { raw: 'Affordable housing', normalized: ['affordable-rental'], rows: 2 },
  { raw: 'Affordable housing with support services', normalized: ['affordable-rental'], rows: 2 },
  { raw: 'Day center', normalized: ['other-unknown'], rows: 2 },
  { raw: 'Group home', normalized: ['other-unknown'], rows: 2 },
  { raw: 'Housing referral and reentry navigation services', normalized: ['housing-navigation'], rows: 2 },
  { raw: 'Long-term group home', normalized: ['other-unknown'], rows: 2 },
  { raw: 'Medical shelter', normalized: ['emergency-shelter'], rows: 2 },
  { raw: 'Men\'s sober house; self-run, self-supported recovery house', normalized: ['recovery-sober'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Men\'s sober housing; democratically run, self-supporting and drug-free home', normalized: ['recovery-sober'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Mental-health services and housing referral', normalized: ['housing-navigation'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Mixed-income apartments (includes affordable/IZ units)', normalized: ['affordable-rental'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Multi-service center and housing referrals', normalized: ['housing-navigation'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Overnight shelter', normalized: ['emergency-shelter'], rows: 2 },
  { raw: 'Permanent supportive housing; scattered-site housing', normalized: ['permanent-supportive'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Proposed residential reentry center / halfway house', normalized: ['transitional'], rows: 2 },
  { raw: 'Public housing', normalized: ['public-housing'], rows: 2 },
  { raw: 'Rapid rehousing / time-limited rental subsidy', normalized: ['rapid-rehousing', 'rental-assistance'], rows: 2 },
  { raw: 'Rapid rehousing with short-term rental assistance', normalized: ['rapid-rehousing'], rows: 2 },
  { raw: 'Residential reentry center (RRC) / halfway house', normalized: ['transitional'], rows: 2 },
  { raw: 'Single-room occupancy housing', normalized: ['sro'], rows: 2 },
  { raw: 'Supportive housing', normalized: ['other-unknown'], rows: 2 },
  { raw: 'Supportive transitional housing (group residence)', normalized: ['transitional'], rows: 2 },
  { raw: 'Temporary emergency shelter', normalized: ['emergency-shelter'], rows: 2 },
  { raw: 'Temporary housing', normalized: ['other-unknown'], rows: 2 },
  { raw: 'Temporary shelter and regular residency', normalized: ['emergency-shelter'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Tenant-based, project-based, and sponsor-based rental assistance', normalized: ['rental-assistance'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional and permanent housing', normalized: ['transitional'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional apartment living', normalized: ['transitional'], rows: 2 },
  { raw: 'Transitional housing; home', normalized: ['transitional'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional housing; supported employment program', normalized: ['transitional'], rows: 2, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional living program', normalized: ['transitional'], rows: 2 },
  { raw: 'Transitional residence within the Reentry Transitional Housing Program', normalized: ['transitional'], rows: 2 },
  { raw: 'temporary housing', normalized: ['other-unknown'], rows: 2 },
  { raw: '24-month transitional housing', normalized: ['transitional'], rows: 1 },
  { raw: 'Addiction and co-occurring recovery housing', normalized: ['recovery-sober'], rows: 1 },
  { raw: 'Affordable apartments (green rehabilitation)', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Affordable apartments plus HUD-approved housing counseling', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Affordable for-sale homes (homeownership)', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Affordable housing connection through subleasing; below-market rental housing', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Affordable housing with wrap-around case management', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Affordable housing with wrap-around support services', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Affordable housing; residence hall for women', normalized: ['affordable-rental'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Affordable rental apartment building for older and disabled persons', normalized: ['affordable-rental'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Affordable rental apartments (intergenerational)', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Apartment-style affordable housing; third phase of Samaritan Inns recovery program', normalized: ['affordable-rental', 'recovery-sober'], rows: 1 },
  { raw: 'Apartment-style transitional housing', normalized: ['transitional'], rows: 1 },
  { raw: 'Apartments / housing units in apartment buildings across Washington, DC, accompanied by supportive services', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Below-market rental housing', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Bridge Housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Central intake and emergency housing assistance', normalized: ['emergency-shelter', 'housing-navigation'], rows: 1 },
  { raw: 'Central intake; eligible families may receive temporary emergency shelter', normalized: ['emergency-shelter', 'housing-navigation'], rows: 1 },
  { raw: 'Citywide housing-access and referral program', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Citywide shelter-access and referral hotline', normalized: ['emergency-shelter', 'housing-navigation'], rows: 1 },
  { raw: 'Cold-weather emergency shelter and warming site', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Cold-weather shelter and warming services', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Community Confinement; residential reentry center; pre-release community correctional services', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Correctional facility', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Correctional facility / detention center', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Crisis stabilization / short-term group home', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Day drop-in center and overnight hypothermia shelter', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Deeply affordable apartments with reentry set-aside (\'Justice Housing\')', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Domestic-violence support and housing referral resource', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Drop-in center; not described as overnight housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Emergency addiction placement and recovery housing', normalized: ['emergency-shelter', 'recovery-sober'], rows: 1 },
  { raw: 'Emergency and transitional housing', normalized: ['transitional', 'emergency-shelter'], rows: 1 },
  { raw: 'Emergency housing support for adults experiencing homelessness; specific housing type is not stated', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Emergency housing support/resource for families experiencing homelessness; specific housing type is not stated', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Emergency mental-health housing', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Emergency shelter (privately funded, faith-based)', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Emergency shelter access, family intake, and referrals into stabilization programs', normalized: ['emergency-shelter', 'housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Emergency shelter and coordinated entry', normalized: ['emergency-shelter', 'housing-navigation'], rows: 1 },
  { raw: 'Emergency shelter and shelter diversion', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Emergency shelter and specialty beds', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Emergency shelter, transitional housing, and substance-use recovery housing', normalized: ['transitional', 'emergency-shelter', 'recovery-sober'], rows: 1 },
  { raw: 'Emergency shelter; short-term emergency housing', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Emergency shelter; transitional rehabilitation/supportive housing', normalized: ['transitional', 'emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Emergency, transitional, and long-term housing', normalized: ['transitional', 'emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Extended transitional housing', normalized: ['transitional'], rows: 1 },
  { raw: 'Faith-based care and housing-related support', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Family housing referral center', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Family reunification transitional housing', normalized: ['transitional'], rows: 1 },
  { raw: 'Family shelter / family resource center', normalized: ['emergency-shelter', 'housing-navigation'], rows: 1 },
  { raw: 'Family shelter access and referral', normalized: ['emergency-shelter', 'housing-navigation'], rows: 1 },
  { raw: 'Family shelter intake', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Family shelter intake and placement', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Family transitional rehabilitation housing', normalized: ['transitional'], rows: 1 },
  { raw: 'Federally assisted public housing', normalized: ['public-housing'], rows: 1 },
  { raw: 'Fully furnished shared living spaces; supportive housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Fully furnished two-bedroom, two-bathroom apartments', normalized: ['other-unknown'], rows: 1 },
  { raw: 'HIV/AIDS transitional housing', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Halfway house / treatment facility', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Homelessness prevention / diversion / housing navigation', normalized: ['homelessness-prevention', 'housing-navigation'], rows: 1 },
  { raw: 'Homelessness prevention; the page describes families having a place to stay for one to 30 nights, but does not identify the housing format', normalized: ['homelessness-prevention'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Housing and shelter, including Permanent Supportive Housing and Transitional Housing', normalized: ['permanent-supportive', 'transitional', 'emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing and shelter; includes permanent supportive housing and transitional housing', normalized: ['permanent-supportive', 'transitional', 'emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing and supportive services; specific housing model not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Housing and supportive services; specific housing type is not stated', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Housing assistance center; low-barrier shelter', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing assistance/referrals', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing choice voucher / rental assistance', normalized: ['rental-assistance'], rows: 1 },
  { raw: 'Housing counseling / housing search assistance', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing counseling and housing opportunities', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing navigation (behavioral-health provider)', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Housing navigation / coordinated entry (system access point)', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Housing navigation / housing placement support', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Housing navigation / reentry support (not direct housing)', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing navigation / rental assistance for veterans', normalized: ['rental-assistance', 'housing-navigation'], rows: 1 },
  { raw: 'Housing programs', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Housing referral and reentry services', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing referral and service coordination', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing referrals', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Housing referrals and support services', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing referrals/support services', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing resource and referral center', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing resource directory and referral guide', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Housing resource locator and referral directory', normalized: ['housing-navigation'], rows: 1 },
  { raw: 'Housing search/locator service (rental and for-sale affordable listings)', normalized: ['affordable-rental', 'housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing services', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Housing stabilization, eviction prevention, and placement support', normalized: ['homelessness-prevention', 'housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing voucher / private-market rental assistance', normalized: ['rental-assistance'], rows: 1 },
  { raw: 'Housing with supportive services', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Housing, shelter, and supportive-services location', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing-access and assessment system for permanent supportive housing vouchers', normalized: ['permanent-supportive', 'housing-navigation'], rows: 1 },
  { raw: 'Housing-first supportive housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Housing-related support and referral resource', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Housing-system coordination and referral resource', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Hyperthermia shelter', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Hypothermia / severe-weather shelter', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Income-restricted rental and for-sale units inside market-rate buildings citywide', normalized: ['affordable-rental', 'market-rate'], rows: 1 },
  { raw: 'LIHTC affordable apartments incl. permanent supportive housing', normalized: ['permanent-supportive'], rows: 1 },
  { raw: 'LIHTC affordable apartments incl. site-based permanent supportive housing', normalized: ['permanent-supportive'], rows: 1 },
  { raw: 'LIHTC affordable apartments with project-based Section 8', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Limited-equity cooperative with Section 8', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Long-term affordable housing connected to an urban aquaponics farm', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Long-term and transitional housing', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Long-term housing intended to support a pathway to stable, permanent housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Long-term independent group living, independent apartment living, and permanent housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Long-term residential housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Long-term supportive/affordable apartment housing', normalized: ['affordable-rental'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Low-barrier emergency youth shelter', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Market-rate and affordable apartment communities', normalized: ['affordable-rental', 'market-rate'], rows: 1 },
  { raw: 'Medical respite care', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Men\'s sober housing', normalized: ['recovery-sober'], rows: 1 },
  { raw: 'Men\'s transitional sober house; democratically run, self-supporting and drug-free home', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Mental-health emergency, transitional, and long-term housing', normalized: ['transitional', 'emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Mixed-income affordable apartments', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Mixed-income affordable rental and for-sale housing', normalized: ['affordable-rental'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Mixed-income apartments with affordable set-aside', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Multi-service day center and housing referrals', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Not publicly listed; reentry planning and benefits-access support services', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Not publicly listed; supportive services addressing housing and food insecurity', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Not publicly listed; treatment-related services', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Overnight emergency shelter and day program', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Overnight shelter and transitional housing', normalized: ['transitional', 'emergency-shelter'], rows: 1 },
  { raw: 'Permanent SRO', normalized: ['sro'], rows: 1 },
  { raw: 'Permanent affordable housing; single room occupancy (SRO)', normalized: ['affordable-rental', 'sro'], rows: 1 },
  { raw: 'Permanent housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Permanent housing; the organization also offers emergency, transitional, and permanent housing options.', normalized: ['transitional', 'emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Permanent rental subsidy', normalized: ['rental-assistance'], rows: 1 },
  { raw: 'Permanent supportive housing (rental subsidy + services)', normalized: ['permanent-supportive'], rows: 1 },
  { raw: 'Permanent supportive housing / housing navigation (scattered site)', normalized: ['permanent-supportive', 'housing-navigation'], rows: 1 },
  { raw: 'Permanent supportive housing and stabilization', normalized: ['permanent-supportive'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Permanent supportive housing voucher / housing navigation', normalized: ['permanent-supportive', 'housing-navigation'], rows: 1 },
  { raw: 'Permanent supportive housing with intensive case management; follows the Housing First model', normalized: ['permanent-supportive'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Permanent supportive housing; site-based housing', normalized: ['permanent-supportive'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Permanent supportive housing; tenant-based and project-based programs; long-term housing subsidy and case management', normalized: ['permanent-supportive', 'rental-assistance'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Permanent, affordable housing; efficiency apartment homes and single room occupancy units', normalized: ['affordable-rental', 'sro'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Permanent-supportive housing', normalized: ['permanent-supportive'], rows: 1 },
  { raw: 'Preserved affordable apartments (scattered buildings)', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Preserved affordable family apartments', normalized: ['affordable-rental'], rows: 1 },
  { raw: 'Preserved affordable/workforce apartments incl. permanent supportive housing', normalized: ['permanent-supportive', 'affordable-rental'], rows: 1 },
  { raw: 'Private-market apartments leased with DC subsidy', normalized: ['rental-assistance'], rows: 1 },
  { raw: 'Private-market rental units leased with DC rental assistance', normalized: ['rental-assistance'], rows: 1 },
  { raw: 'Privately managed rental housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Privately owned/managed apartments and homes (affordable, program-eligible and market-rate)', normalized: ['affordable-rental', 'market-rate'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Project-based assistance producing and maintaining new affordable housing units at qualifying housing projects; projects may include single room occupancy units', normalized: ['affordable-rental', 'sro'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Psychiatric crisis beds', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Public and subsidized housing', normalized: ['rental-assistance'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Public housing waiting list', normalized: ['public-housing'], rows: 1 },
  { raw: 'Public-housing maintenance assistance', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Rapid re-housing; time-limited housing subsidy with case management; families rent apartments throughout Washington, DC', normalized: ['rapid-rehousing', 'rental-assistance'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Rapid rehousing', normalized: ['rapid-rehousing'], rows: 1 },
  { raw: 'Rapid rehousing and homeless prevention services; Housing First model; permanent housing placement', normalized: ['rapid-rehousing'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Rapid rehousing and homelessness prevention', normalized: ['rapid-rehousing', 'homelessness-prevention'], rows: 1 },
  { raw: 'Rapid rehousing; permanent supportive housing; targeted affordable housing; transitional housing', normalized: ['permanent-supportive', 'transitional', 'affordable-rental', 'rapid-rehousing'], rows: 1 },
  { raw: 'Recovery housing', normalized: ['recovery-sober'], rows: 1 },
  { raw: 'Recovery residence; shared home', normalized: ['recovery-sober'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Recovery/sober living; transitional residence; transitional living', normalized: ['transitional', 'recovery-sober'], rows: 1 },
  { raw: 'Reentry health and referral services', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Reentry housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Reentry housing and supportive-services programming', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Reentry housing referrals and coordinated services', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Reentry planning, advocacy, and housing assistance counseling', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Reentry planning, supervision, case management, and housing referrals', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Reentry resource and housing-access referral guide', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Reentry resource and housing-navigation program', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Reentry supportive housing and affordable housing', normalized: ['affordable-rental'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Reentry transitional housing and housing-related services', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Rental assistance', normalized: ['rental-assistance'], rows: 1 },
  { raw: 'Rental assistance / flexible funds', normalized: ['rental-assistance'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Rental assistance / housing navigation', normalized: ['rental-assistance', 'housing-navigation'], rows: 1 },
  { raw: 'Rental assistance / housing navigation / rapid rehousing', normalized: ['rapid-rehousing', 'rental-assistance', 'housing-navigation'], rows: 1 },
  { raw: 'Rental assistance / security deposit / first month\'s rent', normalized: ['rental-assistance'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Residence program; therapeutic housing unit integrating counseling, mentoring, and structured support', normalized: ['housing-navigation'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Residential addiction treatment and transitional housing', normalized: ['transitional', 'recovery-sober'], rows: 1 },
  { raw: 'Residential facility; specific housing type not otherwise stated', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Residential housing; specific housing model not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Residential program; transitional lodging experience for returning citizens', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Residential reentry / halfway-house placement resource', normalized: ['transitional'], rows: 1 },
  { raw: 'Residential reentry / transitional housing', normalized: ['transitional'], rows: 1 },
  { raw: 'Residential reentry center', normalized: ['transitional'], rows: 1 },
  { raw: 'Residential reentry center (RRC), or halfway house', normalized: ['transitional'], rows: 1 },
  { raw: 'Residential reentry center (RRC); halfway house', normalized: ['transitional'], rows: 1 },
  { raw: 'Residential reentry center / halfway house', normalized: ['transitional'], rows: 1 },
  { raw: 'Residential rehabilitation', normalized: ['recovery-sober'], rows: 1 },
  { raw: 'Residential services providing shared housing and support', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Safe housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Safe housing and supportive programming', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Safe housing locations', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Seasonal overnight shelter', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Senior housing/shelter', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Shelter / work bed program', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Shelter and community resources', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Shelter and supportive services', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Shelter and transitional housing', normalized: ['transitional', 'emergency-shelter'], rows: 1 },
  { raw: 'Shelter diversion and rapid-exit housing assistance', normalized: ['emergency-shelter', 'homelessness-prevention'], rows: 1 },
  { raw: 'Short-term and long-term housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Short-term emergency shelter', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Short-term housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Short-term housing with 24-hour support; temporary, transitional, and permanent housing; rental and utility assistance', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Short-term rental assistance and housing services', normalized: ['rental-assistance'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Short-term residential; Residential', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Sober living; recovery/sober living residence', normalized: ['recovery-sober'], rows: 1 },
  { raw: 'Sober living; supportive housing; sober housing; recovery-focused residence', normalized: ['recovery-sober'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Stable housing with support services', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Structured employment, housing, and recovery program', normalized: ['recovery-sober'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Structured transitional housing and recovery program', normalized: ['transitional', 'recovery-sober'], rows: 1 },
  { raw: 'Substance abuse residential rehabilitation facility', normalized: ['recovery-sober'], rows: 1 },
  { raw: 'Supportive group homes and supported independent living', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Supportive housing and housing assistance', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Supportive housing for returning citizens (in development)', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Supportive independent housing support for MBI consumers who already have housing and are having issues with their current housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Supportive residence housing with 24/7 monitoring and supervising care', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Temporary Housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Temporary housing; short-term family housing; shelter-like temporary accommodation', normalized: ['emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Temporary shelter, transitional housing, and permanent supportive housing', normalized: ['permanent-supportive', 'transitional', 'emergency-shelter'], rows: 1 },
  { raw: 'Temporary supportive transitional housing; intermediate step between emergency shelter and permanent housing', normalized: ['transitional', 'emergency-shelter'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Tenant and landlord legal resource', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Tenant housing assistance', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Therapeutic community', normalized: ['recovery-sober'], rows: 1 },
  { raw: 'Transitional and long-term supervised housing', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional and permanent supportive housing', normalized: ['permanent-supportive', 'transitional'], rows: 1 },
  { raw: 'Transitional apartments', normalized: ['transitional'], rows: 1 },
  { raw: 'Transitional home', normalized: ['transitional'], rows: 1 },
  { raw: 'Transitional housing (families)', normalized: ['transitional'], rows: 1 },
  { raw: 'Transitional housing / residential treatment', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional housing and rapid rehousing', normalized: ['transitional', 'rapid-rehousing'], rows: 1 },
  { raw: 'Transitional housing and reentry support', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional housing and supported employment program', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional housing and supportive housing programs', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional housing apartments', normalized: ['transitional'], rows: 1 },
  { raw: 'Transitional housing program', normalized: ['transitional'], rows: 1 },
  { raw: 'Transitional housing; apartment', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional housing; house', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional housing; reentry housing', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional living; furnished apartments with a roommate', normalized: ['transitional'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'Transitional mental-health housing', normalized: ['transitional'], rows: 1 },
  { raw: 'Transitional rehabilitation housing', normalized: ['transitional'], rows: 1 },
  { raw: 'Transitional shelter', normalized: ['transitional'], rows: 1 },
  { raw: 'Winter shelter', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'Women\'s sober house; democratically run, self-supporting and drug-free home', normalized: ['recovery-sober'], rows: 1, flag: 'some descriptive text not recognized; category inferred from the recognized part' },
  { raw: 'affordable rental / transitional / permanent supportive housing', normalized: ['permanent-supportive', 'transitional', 'affordable-rental'], rows: 1 },
  { raw: 'housing assistance', normalized: ['other-unknown'], rows: 1 },
  { raw: 'permanent supportive housing / affordable rental / emergency shelter', normalized: ['permanent-supportive', 'emergency-shelter', 'affordable-rental'], rows: 1 },
  { raw: 'rapid rehousing / homelessness prevention', normalized: ['rapid-rehousing', 'homelessness-prevention'], rows: 1 },
  { raw: 'recovery housing', normalized: ['recovery-sober'], rows: 1 },
  { raw: 'shared housing', normalized: ['other-unknown'], rows: 1 },
  { raw: 'shelter', normalized: ['emergency-shelter'], rows: 1 },
  { raw: 'transitional / rapid rehousing', normalized: ['transitional', 'rapid-rehousing'], rows: 1 },
  { raw: 'transitional-to-permanent housing', normalized: ['transitional'], rows: 1 },
] as const

/** Every distinct raw value in the CSV column "Men / Women / All Genders" mapped
 * to a GenderServed value, with row frequency. */
export const GENDER_MAPPING: readonly RawValueMapping[] = [
  { raw: 'Not publicly listed', normalized: ['other-unknown'], rows: 475 },
  { raw: 'Women', normalized: ['women'], rows: 153 },
  { raw: 'All genders', normalized: ['all-genders'], rows: 142 },
  { raw: 'Men', normalized: ['men'], rows: 91 },
  { raw: 'Men and women', normalized: ['all-genders'], rows: 32 },
  { raw: 'All genders in families', normalized: ['all-genders'], rows: 7 },
  { raw: 'Women and children', normalized: ['women'], rows: 5, flag: 'women-focused description with extra population detail' },
  { raw: 'Men / Women', normalized: ['all-genders'], rows: 3 },
  { raw: 'All Genders', normalized: ['all-genders'], rows: 2 },
  { raw: 'Men, women, and non-conforming individuals', normalized: ['all-genders'], rows: 2 },
  { raw: 'All genders (LGBTQ+ focused)', normalized: ['all-genders'], rows: 1 },
  { raw: 'All genders; all female offenders are housed at CTF', normalized: ['all-genders'], rows: 1 },
  { raw: 'All genders; no men-only or women-only restriction stated', normalized: ['all-genders'], rows: 1 },
  { raw: 'All genders; women with children specifically identified', normalized: ['all-genders'], rows: 1 },
  { raw: 'Male', normalized: ['men'], rows: 1 },
  { raw: 'Male-identifying', normalized: ['men'], rows: 1 },
  { raw: 'Men and Women', normalized: ['all-genders'], rows: 1 },
  { raw: 'Men and families; otherwise not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Men and women in two gender-designated homes; welcomes individuals who are gender nonconforming.', normalized: ['all-genders'], rows: 1 },
  { raw: 'Men’s House and Women’s House; welcomes gender-nonconforming individuals and allows residents to choose where they would like to live.', normalized: ['all-genders'], rows: 1 },
  { raw: 'Men’s House; the overall program welcomes gender-nonconforming individuals and provides residents with a choice of where they would like to live.', normalized: ['men'], rows: 1 },
  { raw: 'No gender restriction publicly stated; page references men and women', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Page states the programming has impacted over 600 men and women; no gender restriction is stated', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Selected women are explicitly identified; other gender eligibility is not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Women and children use the evening program; otherwise not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Women or mixed-gender couples with children', normalized: ['women'], rows: 1, flag: 'women-focused description with extra population detail' },
  { raw: 'Women with children', normalized: ['women'], rows: 1, flag: 'women-focused description with extra population detail' },
  { raw: 'Women-focused service description', normalized: ['women'], rows: 1 },
  { raw: 'Women/female residents only, based on the facility\'s stated population designation and description as a female-only facility. The page discusses case-by-case placement considerations for transgender and intersex residents.', normalized: ['women'], rows: 1 },
  { raw: 'Women/females', normalized: ['women'], rows: 1 },
  { raw: 'Women; adults and families for homelessness services', normalized: ['women'], rows: 1, flag: 'women-focused description with extra population detail' },
  { raw: 'Women; families also served', normalized: ['women'], rows: 1, flag: 'women-focused description with extra population detail' },
  { raw: 'Women’s House; the overall program welcomes gender-nonconforming individuals and provides residents with a choice of where they would like to live.', normalized: ['all-genders'], rows: 1 },
] as const

/** Every distinct raw value in the CSV column "Individuals / Families / Both"
 * mapped to a HouseholdType value, with row frequency. */
export const HOUSEHOLD_MAPPING: readonly RawValueMapping[] = [
  { raw: 'Individuals', normalized: ['individuals'], rows: 315 },
  { raw: 'Both', normalized: ['both'], rows: 246 },
  { raw: 'Not publicly listed', normalized: ['other-unknown'], rows: 217 },
  { raw: 'Families', normalized: ['families'], rows: 111 },
  { raw: 'Individuals and families', normalized: ['both'], rows: 13 },
  { raw: 'Households', normalized: ['both'], rows: 4 },
  { raw: 'Consumers/individuals are referenced; family eligibility is not stated', normalized: ['other-unknown'], rows: 2 },
  { raw: 'Individuals and Families', normalized: ['both'], rows: 2 },
  { raw: 'The page describes services for adults, residents, and individuals; family eligibility is not stated.', normalized: ['other-unknown'], rows: 2 },
  { raw: 'Both individuals and families', normalized: ['both'], rows: 1 },
  { raw: 'Both; programs include women and family-focused programs.', normalized: ['both'], rows: 1 },
  { raw: 'Families and individuals; exact program-specific eligibility not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Families; individuals not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individual participants/clients are described; family eligibility is not publicly listed.', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individuals (seniors)', normalized: ['individuals'], rows: 1 },
  { raw: 'Individuals / Families', normalized: ['both'], rows: 1 },
  { raw: 'Individuals and families; youth also served', normalized: ['both'], rows: 1 },
  { raw: 'Individuals and women-headed households with children', normalized: ['both'], rows: 1, flag: 'individuals plus families with children' },
  { raw: 'Individuals/clients are referenced; family eligibility is not stated', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individuals/persons; whether families are served is not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individuals/residents', normalized: ['individuals'], rows: 1 },
  { raw: 'Individuals/single residents', normalized: ['individuals'], rows: 1 },
  { raw: 'Individuals/single women', normalized: ['individuals'], rows: 1 },
  { raw: 'Individuals; families not stated', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individuals; family eligibility is not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individuals; family eligibility not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individuals; family housing is not stated', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individuals; household composition otherwise not publicly listed', normalized: ['other-unknown'], rows: 1 },
  { raw: 'Individuals; no families or children', normalized: ['individuals'], rows: 1 },
  { raw: 'Individuals; no family or dependent housing is mentioned.', normalized: ['individuals'], rows: 1 },
  { raw: 'Veterans and families; the page specifically references services for DC-area veterans and their families.', normalized: ['both'], rows: 1, flag: 'veterans (individuals) and their families' },
  { raw: 'Veterans and their families', normalized: ['both'], rows: 1, flag: 'veterans (individuals) and their families' },
] as const

/** Every distinct raw value in the CSV column "Ward" mapped to a WardsServed
 * shape (ward numbers as numbers, or the citywide / other-unknown literals),
 * with row frequency. */
export const WARD_MAPPING: readonly RawValueMapping[] = [
  { raw: 'Not publicly listed', normalized: ['other-unknown'], rows: 776 },
  { raw: 'Citywide', normalized: ['citywide'], rows: 74 },
  { raw: 'Ward 1', normalized: [1], rows: 25 },
  { raw: 'Ward 5', normalized: [5], rows: 17 },
  { raw: 'Ward 6', normalized: [6], rows: 10 },
  { raw: 'Ward 8', normalized: [8], rows: 10 },
  { raw: 'Ward 7', normalized: [7], rows: 7 },
  { raw: 'Ward 4', normalized: [4], rows: 6 },
  { raw: 'Ward 2', normalized: [2], rows: 5 },
  { raw: 'Ward 3', normalized: [3], rows: 2 },
  { raw: 'Wards 1, 3, 4 and 8', normalized: [1, 3, 4, 8], rows: 1, flag: 'multi-ward range/list expanded' },
  { raw: 'Wards 5–8', normalized: [5, 6, 7, 8], rows: 1, flag: 'en-dash range expanded to all wards in the range' },
  { raw: 'Wards 7 & 8 service area', normalized: [7, 8], rows: 1, flag: 'multi-ward range/list expanded' },
] as const

/**
 * Row frequency of each approved HousingCategory after normalization. Rows
 * with several categories count once per category, so the total
 * (1073) exceeds the 935 rows. Reflects the owner-approved mappings of
 * 2026-10-10 (RRC / halfway-house rows moved from recovery-sober to
 * transitional, which also deduplicated one row that listed both).
 */
export const HOUSING_CATEGORY_ROW_COUNTS: readonly (readonly [string, number])[] = [
  ['permanent-supportive', 103],
  ['transitional', 183],
  ['emergency-shelter', 162],
  ['affordable-rental', 130],
  ['rapid-rehousing', 23],
  ['recovery-sober', 38],
  ['rental-assistance', 87],
  ['homelessness-prevention', 15],
  ['housing-navigation', 74],
  ['public-housing', 62],
  ['market-rate', 42],
  ['sro', 17],
  ['other-unknown', 137],
] as const

/**
 * How many housing categories a normalized row carries: 805 rows have
 * exactly one, 122 have two, 7 have three and 1 have four.
 */
export const CATEGORIES_PER_ROW: readonly (readonly [number, number])[] = [
  [1, 805],
  [2, 122],
  [3, 7],
  [4, 1],
] as const

/**
 * Coarse RentCostCategory buckets over the CSV column "Rent / Program Cost":
 * income-based 95, subsidized-reduced 35,
 * free 6, and 799 rows with no publicly listed cost.
 */
export const RENT_COST_ROW_COUNTS: readonly (readonly [string, number])[] = [
  ['income-based', 95],
  ['subsidized-reduced', 35],
  ['free', 6],
  ['unlisted', 799],
] as const

// ---------------------------------------------------------------------------
// D.C. address pool
// ---------------------------------------------------------------------------

/** One sampled real D.C. address used by the synthetic generator. */
export interface DcAddressPoolEntry {
  /** Street line, e.g. `1001 14th Street Northwest`. */
  readonly addressLine: string
  /** City name, e.g. `Washington`. */
  readonly locality: string
  /** Five-digit ZIP code, e.g. `20005`. */
  readonly postalCode: string
}

/**
 * 55 real D.C. street addresses the generator samples from (with replacement
 * when a run needs more than 55).
 *
 * Provenance: sampled offline on 2026-10-10 from the NorthMock address
 * generator API (https://us.chatgpt.org.uk, state=DC) for testing and
 * educational use under that service's license. The sample is skewed toward
 * Northwest Washington (nearly all entries are "… Northwest" addresses in
 * central/northwest ZIPs), so generated address strings cluster there; this
 * NW skew is a known limitation of the pool, not of the coordinate sampler
 * (lat/lon stay independent simulated points inside the D.C. polygon).
 * No runtime network access happens anywhere in the app: the records are
 * embedded verbatim below.
 */
export const DC_ADDRESS_POOL: readonly DcAddressPoolEntry[] = [
  { addressLine: '1001 14th Street Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '1007 K Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1009 11th Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1010 Massachusetts Avenue Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1012 10th Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '109 R Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '11 R Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '110 S Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1101 14th Street Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '1111 14th Street Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '1133 15th Street Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '1135 16th Street Northwest', locality: 'Washington', postalCode: '20036' },
  { addressLine: '118 Seaton Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1199 Vermont Avenue Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '124 S Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1275 K Street Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '129 S Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1305 T St NW', locality: 'Washington', postalCode: '20009' },
  { addressLine: '1317 F Street Northwest', locality: 'Washington', postalCode: '20004' },
  { addressLine: '1318 Vermont Avenue Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '1333 H Street Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '135 Florida Avenue Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1399 New York Avenue Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '14 Seaton Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1400 M Street Northwest', locality: 'Washington', postalCode: '20005' },
  { addressLine: '142 Seaton Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1425 4th St SW', locality: 'Washington', postalCode: '20024' },
  { addressLine: '15 S Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '150 Seaton Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '159 Randolph Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '17 R Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '17 Seaton Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1700 H Street Northwest', locality: 'Washington', postalCode: '20006' },
  { addressLine: '1702 1st Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1718 1st Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1806 1st Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '1817 1st Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '20 Massachusetts Avenue Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '20 R Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '20 Randolph Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '20 Rhode Island Avenue Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '26 S Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '28 Quincy Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '28 R Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '30 R Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '31 Quincy Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '3238 R Street Northwest', locality: 'Washington', postalCode: '20007' },
  { addressLine: '36 S Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '37 Seaton Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '39 Quincy Place Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '401 F Street Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '41 Florida Avenue Northwest', locality: 'Washington', postalCode: '20001' },
  { addressLine: '422 8th Street Northwest', locality: 'Washington', postalCode: '20004' },
  { addressLine: '603 P St NW', locality: 'Washington', postalCode: '20001' },
  { addressLine: '76 Seaton Pl NW', locality: 'Washington', postalCode: '20001' },
] as const

// ---------------------------------------------------------------------------
// Final approved generation weights (owner approval: 2026-10-10)
// ---------------------------------------------------------------------------

/**
 * Classification weights in CLASSIFICATIONS order (GENERAL HOUSING — REENTRY
 * ACCESS POSSIBLE, VERIFIED REENTRY HOUSING, VERIFIED
 * CRIMINAL-RECORD-FRIENDLY, NEEDS VERIFICATION). Kept at the CSV row
 * frequencies per the owner's decision.
 */
export const CLASSIFICATION_WEIGHTS: readonly number[] = [765, 108, 60, 2]

/**
 * Demo-balanced GenderServed weights in GENDERS_SERVED order (men, women,
 * all-genders, other-unknown). Synthetic by design — deliberately NOT the CSV
 * distribution, whose 55% unknown rate would starve the demo filters.
 * Unknown rate: 20%.
 */
export const GENDER_WEIGHTS: readonly number[] = [25, 25, 30, 20]

/**
 * Demo-balanced HouseholdType weights in HOUSEHOLD_TYPES order (individuals,
 * families, both, other-unknown). Unknown rate: 20%.
 */
export const HOUSEHOLD_WEIGHTS: readonly number[] = [30, 20, 30, 20]

/**
 * Ward-shape weights: [single-ward, multi-ward, citywide, other-unknown].
 * A single-ward record serves exactly one ward drawn ∝ SINGLE_WARD_WEIGHTS;
 * a multi-ward record serves 2–4 distinct wards (∝ MULTI_WARD_COUNT_WEIGHTS).
 * Citywide and other-unknown are always emitted alone — never mixed with
 * numeric wards. Unknown rate: 25%.
 */
export const WARD_SHAPE_WEIGHTS: readonly number[] = [40, 15, 20, 25]

/** Single-ward weights for wards 1–8 (sums to the single-ward shape weight). */
export const SINGLE_WARD_WEIGHTS: readonly number[] = [6, 4, 3, 5, 6, 5, 5, 6]

/** How many wards a multi-ward record serves: 2, 3, or 4 (weights for 2/3/4). */
export const MULTI_WARD_COUNT_WEIGHTS: readonly number[] = [5, 3, 2]

/**
 * HousingCategory sampling weights in HOUSING_CATEGORIES order. The twelve
 * named categories use the approved CSV row frequencies
 * (HOUSING_CATEGORY_ROW_COUNTS); other-unknown is reduced from its CSV
 * frequency (137) to 60 because synthetic records are never unparseable and
 * the unknown bucket should stay moderate for demo usefulness.
 */
export const HOUSING_CATEGORY_WEIGHTS: readonly number[] = [
  103, 183, 162, 130, 23, 38, 87, 15, 74, 62, 42, 17, 60,
]

/** How many categories a record carries: 1 (mostly), 2 (sometimes), 3 (rarely). */
export const CATEGORY_COUNT_WEIGHTS: readonly number[] = [80, 17, 3]

/**
 * RentCostCategory weights in RENT_COST_CATEGORIES order (income-based,
 * subsidized-reduced, free, market-rate). Synthetic demo distribution —
 * deliberately NOT the CSV's 85.5%-unlisted rate. Every record gets a
 * category and a coherent non-null rentCostText.
 */
export const RENT_COST_WEIGHTS: readonly number[] = [40, 30, 10, 20]

/**
 * Beds/units capacity: three uniform ranges drawn ∝
 * BEDS_UNITS_BUCKET_WEIGHTS, weighted toward smaller facilities. Every
 * record gets an integer >= 1 (never 0).
 */
export const BEDS_UNITS_BUCKET_WEIGHTS: readonly number[] = [50, 30, 20]
export const BEDS_UNITS_BUCKETS: readonly (readonly [number, number])[] = [
  [1, 10],
  [11, 50],
  [51, 200],
]

/** Weights for populationServed being a descriptive string vs null (15%). */
export const POPULATION_SERVED_WEIGHTS: readonly number[] = [85, 15]

/** Data rows in the source CSV, kept for provenance context. */
export const TOTAL_ROWS = 935
