export interface ActivityData {
  id: string;
  title: string;
  description: string;
  category: string;
  tags?: string[];
  location: {
    name: string;
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  price: {
    amount: number;
    currency: string;
    type: string;
  };
  duration: string;
  difficulty: string;
  rating: number;
  reviewCount: number;
  images?: string[];
}

export interface ActivityFilterProps {
  activities: ActivityData[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onActivitySelect: (activity: ActivityData) => void;
}

export interface ActivityMappingOptions {
  defaultCurrency?: string;
  defaultPriceType?: string;
}

