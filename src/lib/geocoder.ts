const cache: Record<string, string> = {};

export async function reverseGeocode(coordString: string): Promise<string> {
    if (!coordString || typeof coordString !== 'string') return '';
    
    // Attempt to extract lat and lng
    const match = coordString.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (!match) return coordString;
    
    const lat = match[1];
    const lon = match[2];
    const cacheKey = `${lat},${lon}`;
    
    if (cache[cacheKey]) {
        return cache[cacheKey];
    }
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
            headers: {
                'Accept-Language': 'de',
                'User-Agent': 'PBefG-Compliance-Auditor/1.0'
            }
        });
        
        if (!response.ok) {
            return coordString; // Fallback
        }
        
        const data = await response.json();
        
        if (data && data.address) {
            const road = data.address.road || '';
            const houseNumber = data.address.house_number || '';
            const city = data.address.city || data.address.town || data.address.village || '';
            
            const formatted = [road, houseNumber].filter(Boolean).join(' ') + (city ? `, ${city}` : '');
            if (formatted.trim()) {
                cache[cacheKey] = formatted;
                return formatted;
            }
        }
        return coordString;
    } catch (e) {
        console.error("Geocoding failed for", coordString, e);
        return coordString;
    }
}
