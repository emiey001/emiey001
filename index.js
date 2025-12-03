import "frida-il2cpp-bridge";

// ======================================
//   MODDRAW GLOBAL STATE (View Model)
// ======================================
let offenseText = "Initializing...";
let offenseDocList = "Waiting for documents...";
let docCorrectText = "N/A";
let corruptText = "N/A";
let confiscateText = "N/A";

const HORIZON_Y = 50;
const SPACING_X = 350;

// ======================================
//   MODDRAW UI SETUP
// ======================================
const drawOverlay = moddraw.create({
    draw: function() {
        // Offense List
        drawOverlay.text({
            x: 50,
            y: HORIZON_Y,
            size: 30,
            color: '#FFFFFF',
            data: offenseText,
            border: 2,
            border_color: '#FF0000',
            background_alpha: 0, // Make background transparent
        });

        // Incorrect Documents
        drawOverlay.text({
            x: 50 + SPACING_X,
            y: HORIZON_Y,
            size: 30,
            color: '#00FF00',
            data: `Incorrect Document: ${docCorrectText}\n${offenseDocList}`,
            border: 2,
            border_color: '#00FF00',
            background_alpha: 0,
        });

        // Corruption Status
        drawOverlay.text({
            x: 50 + (2 * SPACING_X),
            y: HORIZON_Y,
            size: 30,
            color: '#FFFF00',
            data: `Corruption: ${corruptText}`,
            border: 2,
            border_color: '#FFFF00',
            background_alpha: 0,
        });

        // Confiscate Status
        drawOverlay.text({
            x: 50 + (3 * SPACING_X),
            y: HORIZON_Y,
            size: 30,
            color: '#FF00FF',
            data: `Confiscate: ${confiscateText}`,
            border: 2,
            border_color: '#FF00FF',
            background_alpha: 0,
        });
    }
});

// ======================================
//   FRIDA IL2CPP HOOKS
// ======================================
Il2Cpp.perform(() => {
    try {
        const lib = Il2Cpp.domain.assembly("Assembly-CSharp.dll").image;
        const paymentDataClass = lib.class("Days.PaymentData");

        if (!paymentDataClass) {
            console.error("Could not find Days.PaymentData class. Game might be different version.");
            offenseText = "Error: Class not found.";
            return;
        }

        // 1. Hook SetOffenseList
        // Store original method references *before* implementing the hook
        const originalSetOffenseList = paymentDataClass.method("SetOffenseList").implementation;
        paymentDataClass.method("SetOffenseList").implementation = function(dataManager, offenseList) {
            // Call the stored original function instead of recursing via 'this.method("...")'
            const ret = originalSetOffenseList.call(this, dataManager, offenseList);
            logListContents(offenseList);
            return ret;
        };

        // 2. Hook SetOffenseDocuments
        const originalSetOffenseDocuments = paymentDataClass.method("SetOffenseDocuments").implementation;
        paymentDataClass.method("SetOffenseDocuments").implementation = function(dataManager, offenseSettings) {
            const ret = originalSetOffenseDocuments.call(this, dataManager, offenseSettings);

            // Accessing properties and methods via the bridge
            const isDocCorrect = offenseSettings.method("IsIncorrectDocument").invoke();
            docCorrectText = isDocCorrect.toString();

            // Use 'offenseSettings.field("fieldName").value' to get the C# object reference
            const invalidDataList = offenseSettings.field("predefinedInvalidDataList").value;
            processInvalidDataList(invalidDataList);

            return ret;
        };

        // 3. Hook HasNoticedCorruption
        const originalHasNoticedCorruption = paymentDataClass.method("HasNoticedCorruption").implementation;
        paymentDataClass.method("HasNoticedCorruption").implementation = function() {
            const ret = originalHasNoticedCorruption.call(this);
            corruptText = ret.toString();
            return ret;
        };

        // 4. Hook HasNoticedConfiscate
        const originalHasNoticedConfiscate = paymentDataClass.method("HasNoticedConfiscate").implementation;
        paymentDataClass.method("HasNoticedConfiscate").implementation = function() {
            const ret = originalHasNoticedConfiscate.call(this);
            confiscateText = ret.toString();
            return ret;
        };
        
        console.log("Days.PaymentData hooks successfully applied.");

    } catch (e) {
        console.error(`Error during Il2Cpp.perform: ${e}`);
        offenseText = "Initialization Error. Check console.";
    }
});

// ======================================
//   HELPER FUNCTIONS
// ======================================

/**
 * Parses the List<Days.OffenseSO> and updates the offenseText global variable.
 * @param {Il2Cpp.Object} list 
 */
function logListContents(list) {
    if (!list || list.isNull()) { // Check if the object is null/empty
        offenseText = "No Offense";
        return;
    }

    try {
        // Use standard il2cpp-bridge list methods
        const count = list.length; 
        console.log(`Processing ${count} Offenses`);
        let text = "";

        // Iterate through the list using standard iteration pattern
        for (let i = 0; i < count; i++) {
            const item = list.get(i); // Get the element at index i
            
            // Access nested fields
            const offenseSO = item.field("offenseSO").value;

            if (offenseSO && !offenseSO.isNull()) {
                const name = offenseSO.field("offenseName").value;
                const note = offenseSO.field("note").value;
                text += `- ${name}\n`;
                console.log(`Offense: ${name} | Note: ${note}`);
            } else {
                text += `- Undefined offense item ${i + 1}\n`;
            }
        }

        offenseText = text || "No Offenses to display";

    } catch (e) {
        console.log("Error reading Offense list:", e);
        offenseText = "Error displaying offenses.";
    }
}

/**
 * Processes the List<Days.DocumentDataType> enum list.
 * @param {Il2Cpp.Object} invalidDataList 
 */
function processInvalidDataList(invalidDataList) {
    const enumMap = {
        0: "CitizenNumber", 1: "CitizenName", 2: "CitizenDoB", 3: "CitizenSex",
        4: "CitizenCity", 5: "CitizenJob", 6: "CitizenExpiryDate", 7: "CitizenPhoto",
        8: "CitizenSign", 9: "CitizenAddress", 10: "TravelNumber", 11: "TravelCompanyIssue",
        12: "TravelExpiryDate", 13: "TravelDriverName", 14: "TravelPlate", 15: "TravelVehicleType",
        16: "TravelVehicleColor", 17: "TravelDestination", 18: "TravelCargo", 19: "TravelWeight",
        20: "TravelAssignment", 21: "CalendarDate"
    };
    
    let listName = "";
    if (invalidDataList && !invalidDataList.isNull() && invalidDataList.length > 0) {
        for (let i = 0; i < invalidDataList.length; i++) {
            // In il2cpp-bridge, enums often behave as JS numbers when retrieved via .get(i)
            const value = invalidDataList.get(i).value; 
            const docListName = enumMap[value] || `Unknown Value (${value})`;
            listName += `- ${docListName}\n`;
        }
    }
    
    offenseDocList = listName || "All documents appear correct.";
}

