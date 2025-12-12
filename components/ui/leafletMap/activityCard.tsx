"use client";

interface ActivityCardProps {
  activity: {
    id: string;
    title: string;
    description: string;
    category: string;
    price: {
      amount: number;
      currency: string;
      type: string;
    };
    duration: string;
    difficulty: string;
    rating: number;
    reviewCount: number;
  };
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  return (
    <div className="w-64 p-4 bg-white rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold">{activity.title}</h3>
        <span className="text-xs px-2 py-1 bg-gray-100 rounded">{activity.category}</span>
      </div>
      
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {activity.description}
      </p>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Duration:</span>
          <span className="font-medium">{activity.duration}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-500">Difficulty:</span>
          <span className="font-medium capitalize">{activity.difficulty}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-500">Price:</span>
          <span className="font-semibold text-green-600">
            {activity.price.amount} {activity.price.currency}
          </span>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center">
            <span className="text-yellow-500 mr-1">★</span>
            <span className="font-medium">{activity.rating}</span>
            <span className="text-gray-500 text-xs ml-1">({activity.reviewCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
}