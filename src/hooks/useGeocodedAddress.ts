import { useState, useEffect } from 'react';
import { reverseGeocode } from '../lib/geocoder';

export function useGeocodedAddress(coordString?: string) {
    const [address, setAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!coordString) {
            setAddress(null);
            return;
        }

        // Only try to geocode if it looks like coordinates
        const match = coordString.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        if (!match) {
            setAddress(coordString);
            return;
        }

        let isMounted = true;
        setIsLoading(true);
        
        reverseGeocode(coordString).then((res) => {
            if (isMounted) {
                setAddress(res);
                setIsLoading(false);
            }
        }).catch(() => {
            if (isMounted) {
                setIsLoading(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [coordString]);

    return { address, isLoading };
}
