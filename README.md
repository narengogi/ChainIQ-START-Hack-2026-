# ChainIQ-START-Hack-2026-
 
1.   TOPIC OF THE CASE:
●	Sourcing intelligence

2.   TITLE OF CASE:
●	Audit-Ready Autonomous Sourcing Agent

3.   CASE SUMMARY (2 - 4 SENTENCES):
What is the problem to be solved? Which outcome is expected as a final product? Who gets addressed by this case?
A.	What is the current problem?
●	Large organizations receive purchase requests that are incomplete, inconsistent, or urgent. Procurement professionals must interpret these requests, apply internal rules, compare suppliers, and later justify their decisions in audits. The process is manual, difficult to scale, and dependent on individual experience.
B.	What is the expected final product?
●	A working prototype that converts an unstructured purchase request into a structured, defensible supplier comparison. The system must apply procurement rules, identify contradictions or policy violations, and clearly explain its reasoning. It must demonstrate escalation logic when a compliant decision cannot be made automatically and confidently.
C.	Who are the users of this solution?
●	Procurement managers
●	Category  buyers
●	Compliance and risk reviewers
●	Business stakeholders requesting purchases
 
4.   DATA:
What numbers, text or images are necessary to solve the case? Which datasets are provided by your company? Which additional data sources may be helpful?
●	All core datasets will be provided in machine-readable formats (JSON / CSV) to allow teams to focus on reasoning and system design.
○	Provided dataset (illustrative):[DR1.1][DR1.2][DR1.3]
■	requests.json
Free-text purchase requests including:
●	Standard cases
●	Missing information
●	Conflicting requirements
●	Requests that exceed thresholds
●	Requests referencing restricted suppliers
■	suppliers.csv
Supplier master data including:
●	Category coverage
●	Pricing tiers
●	Lead times
●	Geographic information
●	Basic risk flags
■	pricing.csv
Pricing structures, volume tiers, minimum order quantities
■	policies.json
Basic procurement rules including:
●	Approval thresholds
●	Preferred supplier lists
●	Restricted suppliers
●	Category constraints
■	historical_awards.csv
Past supplier decisions for reference
■	Optional stretch data:
●	ESG scoring
●	Data residency rules
●	Additional regulatory constraints
 
5.   TECHNOLOGY:
Which APIs, SDKs, software, or hardware components are vital to get the job done? How will you provide the necessary technology?
●	Azure credits are available
●	The teams may use any language, UI, AI and/or rules engines appropriate

6.   USE CASE (AND BUSINESS CASE)
What job does it do well for the users? Are the participants supposed to come with a use case?
Core Use Case
A stakeholder submits a purchase request (e.g. “Need 500 laptops in 2 weeks, prefer Supplier X, budget 400k”).
The system must:
1.	Extract structured requirements
2.	Detect missing or contradictory information
3.	Apply procurement rules
4.	Identify compliant supplier options
5.	Present a ranked comparison
6.	Provide clear reasoning
7.	Flag when escalation is required

Core Business Case
This solution improves:
•	Decision consistency
•	Compliance adherence
•	Audit transparency
•	Procurement cycle time
It supports scalable procurement operations without removing human oversight.

Optional Stretch Use Case
Advanced teams may also:
•	Enforce geographic or regulatory constraints
•	Simulate approval routing logic
•	Implement confidence scoring
•	Generate a structured audit document
These are not required for a valid submission.

 
7.   JUDGMENT CRITERIA:
Judgment criteria are important for the participants to understand the focus of the case. You could either focus more on the technical aspect (coding and programming), on the business aspect (product fitting in the market), or it can be both. Please also add the weighted criteria.
●	Creativity (20%)
○	Clear, practical, and innovative approach to structuring requests and supplier comparison.
●	Visual design (10%)
○	Clarity of comparison view and decision explanation
●	Feasibility (25%)
○	Realistic architecture and deployability
●	Reachability (20%)
○	Does the solution address real procurement challenges effectively?
●	Robustness and escalation logic (25%)
○	Ability to handle contradictions, rule violations, and uncertainty appropriately
 
8.   PRESENTATION PROTOTYPE:
What does the partner expect from the participants’ presentation?
Format: 
●	Live demo (5 minutes demo + 3 minutes explanation)
Key elements:
●	Walkthrough of one standard request
●	Walkthrough of one edge case
●	Supplier comparison view
●	Explanation of rule application
●	Demonstration of escalation handling
Requirements:
●	Working prototype
●	Clear reasoning logic
●	Short explanation of system design
●	Brief statement on how it could scale in production

9. PRIZE:
What does the winning team get as a price?
-	Paid Internship for 2-3 months and idea implementation 
-	AirPods Max 

