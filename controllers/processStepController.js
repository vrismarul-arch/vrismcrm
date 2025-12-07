const ProcessStep = require("../models/ProcessStep");

// ====================================================================
// CRUD TEMPLATE LOGIC
// ====================================================================

/**
 * @description Creates a new Step Group template (POST /api/steps)
 * This logic handles inserting multiple steps for a single stepType.
 */
exports.createStepGroup = async (req, res) => {
    try {
        const { stepType, steps } = req.body;

        // Prevent creation if the step type already exists
        const existingSteps = await ProcessStep.find({ stepType });
        if (existingSteps.length > 0) {
            return res.status(409).json({ message: `Step Type "${stepType}" already exists. Please use PUT to update.` });
        }

        if (!steps || steps.length === 0)
            return res.status(400).json({ message: "Steps are required" });

        // Format steps: assign stepType and set order
        const formattedSteps = steps.map((step, i) => ({
            ...step,
            stepType,
            order: i + 1,
        }));

        const createdSteps = await ProcessStep.insertMany(formattedSteps);

        res.status(201).json({ success: true, createdSteps });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @description Updates/Replaces an existing Step Group template (PUT /api/steps/:stepType)
 * This logic deletes all old steps for the type and inserts the new ones.
 */
exports.updateStepGroup = async (req, res) => {
    try {
        const stepTypeToUpdate = req.params.stepType; // Gets the stepType (Service Name) from the URL
        const { steps } = req.body;

        if (!steps || steps.length === 0)
            return res.status(400).json({ message: "Steps array is required" });

        // 1. Delete all existing steps for this stepType
        await ProcessStep.deleteMany({ stepType: stepTypeToUpdate });

        // 2. Format and insert the new steps
        const formattedSteps = steps.map((step, i) => ({
            ...step,
            stepType: stepTypeToUpdate,
            order: i + 1,
        }));

        const updatedSteps = await ProcessStep.insertMany(formattedSteps);

        res.status(200).json({ success: true, updatedSteps });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @description Retrieves all Step Templates grouped by stepType (GET /api/steps)
 */
exports.getGroupedSteps = async (req, res) => {
    try {
        const grouped = await ProcessStep.aggregate([
            {
                $group: {
                    _id: "$stepType", // Group by the stepType field
                    steps: { $push: "$$ROOT" }, // Push all step details into an array
                }
            },
            {
                $sort: { '_id': 1 } // Sort groups alphabetically
            }
        ]);

        res.json(grouped);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @description Deletes an entire Step Group by stepType (DELETE /api/steps/:stepType)
 */
exports.deleteStepGroup = async (req, res) => {
    try {
        const stepTypeToDelete = req.params.stepType; // Gets the stepType from the URL
        const result = await ProcessStep.deleteMany({ stepType: stepTypeToDelete });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: `Step Group '${stepTypeToDelete}' not found.` });
        }

        res.json({ success: true, message: `Step Group '${stepTypeToDelete}' Deleted` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * @description Deletes a single Step item by Mongoose _id (DELETE /api/steps/step/:id)
 */
exports.deleteStep = async (req, res) => {
    try {
        // Assumes req.params.id is the Mongoose _id of a single step document
        const deletedStep = await ProcessStep.findByIdAndDelete(req.params.id);

        if (!deletedStep) {
            return res.status(404).json({ message: "Individual step not found." });
        }

        res.json({ success: true, message: "Individual Step Deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ====================================================================
// PROJECT LOGIC (Middleware for Project Creation)
// ====================================================================

/**
 * @description Middleware to auto-populate default steps onto a new project object.
 */
exports.populateDefaultSteps = async (req, res, next) => {
    // Only run this logic on project creation (not update)
    const isNewProject = !req.params.id;
    const stepType = req.body.serviceName;

    if (isNewProject && stepType) {
        try {
            // Find the Step Template for the selected Service (stepType)
            const templates = await ProcessStep.find({ stepType: stepType }).sort({ order: 1 });

            if (templates && templates.length > 0) {
                // Map the template steps to the project steps, changing status to 'Pending'
                const defaultProjectSteps = templates.map(template => ({
                    stepName: template.stepName,
                    description: template.description,
                    url: template.url,
                    // IMPORTANT: Set the initial status for a project step
                    status: 'Pending', 
                    order: template.order,
                }));
                
                // Attach the default steps to the project data (req.body)
                req.body.steps = defaultProjectSteps;
            }
        } catch (error) {
            console.error("Error populating default steps:", error);
            // Non-critical failure: continue to project save without steps
        }
    }
    
    next(); // Continue to the actual project saving controller
};