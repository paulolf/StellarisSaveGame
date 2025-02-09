let editor;
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Ace editor
    const editorElement = document.getElementById('jsonEditor');
    if (editorElement) {
        editor = ace.edit("jsonEditor");
        editor.setTheme("ace/theme/monokai");
        editor.session.setMode("ace/mode/text");
        editor.setOptions({
            fontSize: "12pt",
            showPrintMargin: false,
            showGutter: true,
            highlightActiveLine: true,
            wrap: true
        });

        // Add undo/redo keyboard shortcuts
        editor.commands.addCommand({
            name: 'undo',
            bindKey: {win: 'Ctrl-Z', mac: 'Command-Z'},
            exec: function(editor) {
                undoLastAction();
            }
        });

        editor.commands.addCommand({
            name: 'redo',
            bindKey: {win: 'Ctrl-Y', mac: 'Command-Shift-Z'},
            exec: function(editor) {
                redoLastAction();
            }
        });
    }

    // Add save button handler
    const saveButton = document.getElementById('saveChanges');
    if (saveButton) {
        saveButton.addEventListener('click', saveGameData);
    }

    // Add resource input handlers
    const resourceInputs = [
        'energyCredits',
        'minerals',
        'food',
        'influence',
        'unity'
    ];

    resourceInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', (event) => {
                const oldValue = parseFloat(input.dataset.lastValue || '0');
                const newValue = parseFloat(event.target.value);
                
                if (validateResourceInput(event)) {
                    recordAction({
                        type: 'resource',
                        resourceId: id,
                        oldValue: oldValue,
                        newValue: newValue,
                        undo: () => {
                            input.value = oldValue;
                            input.dataset.lastValue = oldValue;
                        },
                        redo: () => {
                            input.value = newValue;
                            input.dataset.lastValue = newValue;
                        }
                    });
                    input.dataset.lastValue = newValue;
                }
            });
            
            // Store initial value
            input.dataset.lastValue = input.value;
        }
    });

    // Add undo/redo buttons if they exist
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    
    if (undoButton) {
        undoButton.addEventListener('click', undoLastAction);
        updateUndoRedoButtons();
    }
    
    if (redoButton) {
        redoButton.addEventListener('click', redoLastAction);
        updateUndoRedoButtons();
    }
});

function recordAction(action) {
    undoStack.push(action);
    redoStack = []; // Clear redo stack when new action is recorded
    
    // Limit stack size
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    
    updateUndoRedoButtons();
}

function undoLastAction() {
    if (undoStack.length === 0) return;
    
    const action = undoStack.pop();
    action.undo();
    redoStack.push(action);
    
    updateUndoRedoButtons();
}

function redoLastAction() {
    if (redoStack.length === 0) return;
    
    const action = redoStack.pop();
    action.redo();
    undoStack.push(action);
    
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    
    if (undoButton) {
        undoButton.disabled = undoStack.length === 0;
        undoButton.title = undoStack.length > 0 
            ? `Undo ${undoStack[undoStack.length - 1].type}` 
            : 'Nothing to undo';
    }
    
    if (redoButton) {
        redoButton.disabled = redoStack.length === 0;
        redoButton.title = redoStack.length > 0 
            ? `Redo ${redoStack[redoStack.length - 1].type}` 
            : 'Nothing to redo';
    }
}

function validateResourceInput(event) {
    const input = event.target;
    const value = parseFloat(input.value);
    
    // Basic validation rules
    switch (input.id) {
        case 'energyCredits':
            if (value < -10000) {
                showError(input, 'Energy credits cannot be less than -10,000');
                return false;
            }
            break;
        case 'minerals':
        case 'food':
        case 'unity':
            if (value < 0) {
                showError(input, `${input.id.charAt(0).toUpperCase() + input.id.slice(1)} cannot be negative`);
                return false;
            }
            break;
        case 'influence':
            if (value < 0) {
                showError(input, 'Influence cannot be negative');
                return false;
            } else if (value > 1000) {
                showError(input, 'Influence cannot exceed 1,000');
                return false;
            }
            break;
    }
    return true;
}

function showError(input, message) {
    input.value = input.dataset.lastValue || 0;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback d-block';
    errorDiv.textContent = message;
    
    // Remove any existing error message
    const existingError = input.parentElement.querySelector('.invalid-feedback');
    if (existingError) {
        existingError.remove();
    }
    
    input.parentElement.appendChild(errorDiv);
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

async function saveGameData() {
    if (!editor) return;

    const saveStatus = document.getElementById('saveStatus');
    saveStatus.textContent = 'Saving...';
    
    try {
        const token = document.querySelector('input[name="__RequestVerificationToken"]').value;
        const response = await fetch('?handler=Save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'RequestVerificationToken': token
            },
            body: JSON.stringify({
                saveData: editor.getValue(),
                meta: '' // We'll need to preserve the original meta data in a future update
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            
            if (errorData.errors && errorData.errors.length > 0) {
                throw new Error(errorData.errors.join('\n'));
            }
            
            throw new Error(errorData.error || 'Failed to save game file');
        }

        // Get the file blob from the response
        const blob = await response.blob();
        
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modified_save.sav';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        saveStatus.textContent = 'Saved successfully!';
        setTimeout(() => {
            saveStatus.textContent = '';
        }, 3000);
    } catch (error) {
        console.error('Error saving game data:', error);
        saveStatus.textContent = `Error: ${error.message}`;
    }
}

// District Management
function updateDistricts(districts) {
    // Update standard districts
    $('#cityDistricts').val(districts.city?.count || 0);
    $('#maxCityDistricts').text(districts.city?.maxCount || 0);
    $('#miningDistricts').val(districts.mining?.count || 0);
    $('#maxMiningDistricts').text(districts.mining?.maxCount || 0);
    $('#agricultureDistricts').val(districts.agriculture?.count || 0);
    $('#maxAgricultureDistricts').text(districts.agriculture?.maxCount || 0);
    $('#generatorDistricts').val(districts.generator?.count || 0);
    $('#maxGeneratorDistricts').text(districts.generator?.maxCount || 0);
    $('#nexusDistricts').val(districts.nexus?.count || 0);
    $('#maxNexusDistricts').text(districts.nexus?.maxCount || 0);
    $('#habitatDistricts').val(districts.habitat?.count || 0);
    $('#maxHabitatDistricts').text(districts.habitat?.maxCount || 0);
    $('#hiveDistricts').val(districts.hive?.count || 0);
    $('#maxHiveDistricts').text(districts.hive?.maxCount || 0);

    // Update custom districts
    const container = $('#customDistrictsContainer');
    container.empty();

    Object.entries(districts.custom || {}).forEach(([type, info]) => {
        addCustomDistrictUI(container, type, info);
    });
}

function getDistrictsData() {
    const districts = {
        city: {
            count: parseInt($('#cityDistricts').val()) || 0,
            maxCount: parseInt($('#maxCityDistricts').text()) || 0,
            available: true
        },
        mining: {
            count: parseInt($('#miningDistricts').val()) || 0,
            maxCount: parseInt($('#maxMiningDistricts').text()) || 0,
            available: true
        },
        agriculture: {
            count: parseInt($('#agricultureDistricts').val()) || 0,
            maxCount: parseInt($('#maxAgricultureDistricts').text()) || 0,
            available: true
        },
        generator: {
            count: parseInt($('#generatorDistricts').val()) || 0,
            maxCount: parseInt($('#maxGeneratorDistricts').text()) || 0,
            available: true
        },
        nexus: {
            count: parseInt($('#nexusDistricts').val()) || 0,
            maxCount: parseInt($('#maxNexusDistricts').text()) || 0,
            available: true
        },
        habitat: {
            count: parseInt($('#habitatDistricts').val()) || 0,
            maxCount: parseInt($('#maxHabitatDistricts').text()) || 0,
            available: true
        },
        hive: {
            count: parseInt($('#hiveDistricts').val()) || 0,
            maxCount: parseInt($('#maxHiveDistricts').text()) || 0,
            available: true
        },
        custom: {}
    };

    // Collect custom districts
    $('#customDistrictsContainer .custom-district').each(function() {
        const type = $(this).data('type');
        districts.custom[type] = {
            count: parseInt($(this).find('.district-count').val()) || 0,
            maxCount: parseInt($(this).find('.district-max').val()) || 0,
            available: $(this).find('.district-available').prop('checked')
        };
    });

    return districts;
}

function addCustomDistrictUI(container, type = '', info = { count: 0, maxCount: 0, available: true }) {
    const districtHtml = `
        <div class="custom-district mb-3" data-type="${type}">
            <div class="row">
                <div class="col-md-4">
                    <input type="text" class="form-control district-type" placeholder="District Type" value="${type}">
                </div>
                <div class="col-md-3">
                    <input type="number" class="form-control district-count" placeholder="Count" value="${info.count}" min="0">
                </div>
                <div class="col-md-3">
                    <input type="number" class="form-control district-max" placeholder="Max" value="${info.maxCount}" min="0">
                </div>
                <div class="col-md-2">
                    <div class="form-check">
                        <input class="form-check-input district-available" type="checkbox" ${info.available ? 'checked' : ''}>
                        <label class="form-check-label">Available</label>
                    </div>
                    <button type="button" class="btn btn-outline-danger btn-sm remove-district">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    container.append(districtHtml);
}

// Modifier Management
function updateModifiers(modifiers) {
    const container = $('#modifiersContainer');
    container.empty();

    modifiers.forEach(modifier => {
        addModifierUI(container, modifier);
    });
}

function getModifiersData() {
    const modifiers = [];
    $('#modifiersContainer .modifier').each(function() {
        const modifier = {
            id: $(this).find('.modifier-id').val(),
            name: $(this).find('.modifier-name').val(),
            daysRemaining: parseInt($(this).find('.modifier-days').val()) || -1,
            effects: {}
        };

        $(this).find('.modifier-effect').each(function() {
            const effect = $(this).find('.effect-type').val();
            const value = parseFloat($(this).find('.effect-value').val()) || 0;
            if (effect && !isNaN(value)) {
                modifier.effects[effect] = value;
            }
        });

        if (modifier.id) {
            modifiers.push(modifier);
        }
    });

    return modifiers;
}

function addModifierUI(container, modifier = { id: '', name: '', daysRemaining: -1, effects: {} }) {
    const modifierHtml = `
        <div class="modifier card mb-3">
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-4">
                        <input type="text" class="form-control modifier-id" placeholder="Modifier ID" value="${modifier.id}">
                    </div>
                    <div class="col-md-4">
                        <input type="text" class="form-control modifier-name" placeholder="Display Name" value="${modifier.name}">
                    </div>
                    <div class="col-md-3">
                        <input type="number" class="form-control modifier-days" placeholder="Days Remaining" value="${modifier.daysRemaining}" min="-1">
                    </div>
                    <div class="col-md-1">
                        <button type="button" class="btn btn-outline-danger remove-modifier">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="modifier-effects">
                    ${Object.entries(modifier.effects).map(([effect, value]) => `
                        <div class="modifier-effect row mb-2">
                            <div class="col-md-6">
                                <input type="text" class="form-control effect-type" placeholder="Effect Type" value="${effect}">
                            </div>
                            <div class="col-md-5">
                                <input type="number" class="form-control effect-value" placeholder="Value" value="${value}" step="0.1">
                            </div>
                            <div class="col-md-1">
                                <button type="button" class="btn btn-outline-danger btn-sm remove-effect">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-outline-secondary btn-sm mt-2 add-effect">
                    <i class="bi bi-plus-circle"></i> Add Effect
                </button>
            </div>
        </div>
    `;
    container.append(modifierHtml);
}

// Planet Transformation Management
const planetTypes = {
    "pc_continental": "Continental World",
    "pc_tropical": "Tropical World",
    "pc_arid": "Arid World",
    "pc_desert": "Desert World",
    "pc_tundra": "Tundra World",
    "pc_arctic": "Arctic World",
    "pc_alpine": "Alpine World",
    "pc_savannah": "Savannah World",
    "pc_ocean": "Ocean World",
    "pc_gaia": "Gaia World",
    "pc_ringworld_habitable": "Ringworld Section",
    "pc_habitat": "Habitat",
    "pc_relic": "Relic World",
    "pc_city": "Ecumenopolis",
    "pc_hive": "Hive World",
    "pc_machine": "Machine World",
    "pc_toxic": "Toxic World",
    "pc_nuked": "Tomb World",
    "pc_gas_giant": "Gas Giant",
    "pc_molten": "Molten World",
    "pc_barren": "Barren World",
    "pc_barren_cold": "Frozen World",
    "pc_asteroid": "Asteroid"
};

const transformationPaths = {
    "pc_nuked": ["pc_continental", "pc_tropical", "pc_arid", "pc_desert", "pc_tundra", "pc_arctic", "pc_alpine"],
    "pc_toxic": ["pc_continental", "pc_tropical", "pc_arid", "pc_desert", "pc_tundra", "pc_arctic", "pc_alpine"],
    "pc_barren": ["pc_continental", "pc_tropical", "pc_arid", "pc_desert", "pc_tundra", "pc_arctic", "pc_alpine"],
    "pc_barren_cold": ["pc_arctic", "pc_alpine", "pc_tundra"],
    "pc_continental": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"],
    "pc_tropical": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"],
    "pc_arid": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"],
    "pc_desert": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"],
    "pc_tundra": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"],
    "pc_arctic": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"],
    "pc_alpine": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"],
    "pc_savannah": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"],
    "pc_ocean": ["pc_gaia", "pc_city", "pc_hive", "pc_machine"]
};

const defaultPlanetSizes = {
    "pc_continental": 25,
    "pc_tropical": 25,
    "pc_arid": 25,
    "pc_desert": 25,
    "pc_tundra": 25,
    "pc_arctic": 25,
    "pc_alpine": 25,
    "pc_savannah": 25,
    "pc_ocean": 25,
    "pc_gaia": 30,
    "pc_ringworld_habitable": 50,
    "pc_habitat": 8,
    "pc_relic": 15,
    "pc_city": 40,
    "pc_hive": 35,
    "pc_machine": 35,
    "pc_toxic": 20,
    "pc_nuked": 20,
    "pc_barren": 15,
    "pc_barren_cold": 15,
    "pc_gas_giant": 30,
    "pc_molten": 15,
    "pc_asteroid": 5
};

function initializePlanetTypeSelect() {
    const select = $('#planetType');
    select.empty();
    
    Object.entries(planetTypes).forEach(([value, text]) => {
        select.append($('<option>', {
            value: value,
            text: text
        }));
    });

    select.on('change', function() {
        updateAvailableTransformations($(this).val());
        updateDefaultSize($(this).val());
    });
}

function updateAvailableTransformations(planetType) {
    const container = $('#availableTransformations');
    container.empty();

    const availableTypes = transformationPaths[planetType] || [];
    if (availableTypes.length === 0) {
        container.append('<p>No transformations available for this planet type.</p>');
        return;
    }

    const transformList = $('<div class="row g-2">');
    availableTypes.forEach(type => {
        transformList.append(`
            <div class="col-md-4">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">${planetTypes[type]}</h6>
                        <button class="btn btn-sm btn-outline-primary transform-to" data-type="${type}">
                            Transform to this type
                        </button>
                    </div>
                </div>
            </div>
        `);
    });

    container.append(transformList);
}

function updateDefaultSize(planetType) {
    const defaultSize = defaultPlanetSizes[planetType] || 15;
    $('#planetSize').val(defaultSize);
}

function updateNeighboringPlanets(neighbors) {
    const container = $('#neighboringPlanets');
    container.empty();

    if (!neighbors || neighbors.length === 0) {
        container.append('<p>No neighboring planets found.</p>');
        return;
    }

    neighbors.forEach(planet => {
        container.append(`
            <div class="list-group-item">
                <div class="form-check">
                    <input class="form-check-input neighbor-select" type="checkbox" value="${planet.id}" id="neighbor${planet.id}">
                    <label class="form-check-label" for="neighbor${planet.id}">
                        ${planet.name} (${planetTypes[planet.type] || planet.type})
                    </label>
                </div>
            </div>
        `);
    });
}

function transformPlanet(planetId, newType) {
    const defaultSize = defaultPlanetSizes[newType] || 15;
    
    // Record the action for undo/redo
    const action = {
        type: 'transform_planet',
        planetId: planetId,
        oldType: currentPlanet.type,
        oldSize: currentPlanet.size,
        newType: newType,
        newSize: defaultSize
    };
    
    recordAction(action);

    // Update the planet
    currentPlanet.type = newType;
    currentPlanet.size = defaultSize;
    
    // Reset districts when transforming
    currentPlanet.districts = {
        city: { count: 0, maxCount: defaultSize, available: true },
        mining: { count: 0, maxCount: defaultSize, available: true },
        agriculture: { count: 0, maxCount: defaultSize, available: true },
        generator: { count: 0, maxCount: defaultSize, available: true },
        nexus: { count: 0, maxCount: defaultSize, available: true },
        habitat: { count: 0, maxCount: defaultSize, available: true },
        hive: { count: 0, maxCount: defaultSize, available: true },
        custom: {}
    };

    // Update UI
    updateUI(currentPlanet);
    showSuccessMessage(`Planet transformed to ${planetTypes[newType]}`);
}

function transformNeighbors(newType) {
    const selectedNeighbors = $('.neighbor-select:checked').map(function() {
        return $(this).val();
    }).get();

    if (selectedNeighbors.length === 0) {
        showErrorMessage('No neighboring planets selected');
        return;
    }

    // Record the action for undo/redo
    const action = {
        type: 'transform_neighbors',
        planets: selectedNeighbors.map(id => ({
            id: id,
            oldType: currentPlanet.neighboringPlanets.find(p => p.id === id).type,
            newType: newType
        }))
    };
    
    recordAction(action);

    // Transform each selected neighbor
    selectedNeighbors.forEach(id => {
        const neighbor = currentPlanet.neighboringPlanets.find(p => p.id === id);
        if (neighbor) {
            neighbor.type = newType;
            neighbor.size = defaultPlanetSizes[newType] || 15;
        }
    });

    // Update UI
    updateNeighboringPlanets(currentPlanet.neighboringPlanets);
    showSuccessMessage(`${selectedNeighbors.length} planets transformed to ${planetTypes[newType]}`);
}

// Event Handlers
$(document).ready(function() {
    // District event handlers
    $('#addCustomDistrict').click(function() {
        addCustomDistrictUI($('#customDistrictsContainer'));
    });

    $(document).on('click', '.remove-district', function() {
        $(this).closest('.custom-district').remove();
    });

    // Modifier event handlers
    $('#addModifier').click(function() {
        addModifierUI($('#modifiersContainer'));
    });

    $(document).on('click', '.remove-modifier', function() {
        $(this).closest('.modifier').remove();
    });

    $(document).on('click', '.add-effect', function() {
        const effectsContainer = $(this).siblings('.modifier-effects');
        const effectHtml = `
            <div class="modifier-effect row mb-2">
                <div class="col-md-6">
                    <input type="text" class="form-control effect-type" placeholder="Effect Type">
                </div>
                <div class="col-md-5">
                    <input type="number" class="form-control effect-value" placeholder="Value" step="0.1">
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-outline-danger btn-sm remove-effect">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
        effectsContainer.append(effectHtml);
    });

    $(document).on('click', '.remove-effect', function() {
        $(this).closest('.modifier-effect').remove();
    });

    // Planet transformation event handlers
    initializePlanetTypeSelect();

    $('#transformPlanet').click(function() {
        const newType = $('#planetType').val();
        if (!newType) {
            showErrorMessage('Please select a planet type');
            return;
        }
        transformPlanet(currentPlanet.id, newType);
    });

    $('#transformNeighbors').click(function() {
        const newType = $('#planetType').val();
        if (!newType) {
            showErrorMessage('Please select a planet type');
            return;
        }
        transformNeighbors(newType);
    });

    $(document).on('click', '.transform-to', function() {
        const newType = $(this).data('type');
        transformPlanet(currentPlanet.id, newType);
    });

    // Update save data to include districts and modifiers
    function getSaveData() {
        return {
            ...currentSaveData,
            districts: getDistrictsData(),
            modifiers: getModifiersData()
        };
    }

    // Update UI when loading save data
    function updateUI(data) {
        if (data.districts) {
            updateDistricts(data.districts);
        }
        if (data.modifiers) {
            updateModifiers(data.modifiers);
        }
        if (data.type) {
            $('#planetType').val(data.type);
            updateAvailableTransformations(data.type);
        }
        if (data.size) {
            $('#planetSize').val(data.size);
        }
        if (data.neighboringPlanets) {
            updateNeighboringPlanets(data.neighboringPlanets);
        }
    }
});
