import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Modal,
  StatusBar,
  Alert
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  category_name?: string;
  description: string;
  unit_type: string;
  current_quantity: number;
  min_quantity: number;
  purchase_price: number;
  sale_price: number;
  location: string;
  expiry_date: string | null;
  batch_number: string | null;
  clinic_id: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
}

const InventoryScreen = ({ navigation }: any) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);

  // Temporary placeholder data
  const placeholderInventory: InventoryItem[] = [
    {
      id: '1',
      name: 'Amoxicillin 500mg',
      sku: 'AMX500',
      category_id: '1',
      category_name: 'Antibiotics',
      description: 'Broad-spectrum antibiotic',
      unit_type: 'Tablet',
      current_quantity: 250,
      min_quantity: 50,
      purchase_price: 0.85,
      sale_price: 2.00,
      location: 'Main Cabinet A3',
      expiry_date: '2023-12-31',
      batch_number: 'LOT123456',
      clinic_id: 1,
      created_at: '2023-01-15',
      updated_at: '2023-05-20',
      is_active: true
    },
    {
      id: '2',
      name: 'Dog Food - Premium Mix',
      sku: 'DF001',
      category_id: '2',
      category_name: 'Food',
      description: 'Premium dog food for all breeds',
      unit_type: 'Bag (5kg)',
      current_quantity: 15,
      min_quantity: 5,
      purchase_price: 25.00,
      sale_price: 42.99,
      location: 'Storage Room B',
      expiry_date: '2023-11-15',
      batch_number: 'BT789012',
      clinic_id: 1,
      created_at: '2023-02-01',
      updated_at: '2023-07-10',
      is_active: true
    },
    {
      id: '3',
      name: 'Flea & Tick Collar',
      sku: 'FTC100',
      category_id: '3',
      category_name: 'Accessories',
      description: 'Prevents fleas and ticks for up to 8 months',
      unit_type: 'Piece',
      current_quantity: 30,
      min_quantity: 10,
      purchase_price: 15.50,
      sale_price: 29.99,
      location: 'Retail Display C2',
      expiry_date: null,
      batch_number: null,
      clinic_id: 1,
      created_at: '2023-03-05',
      updated_at: '2023-06-22',
      is_active: true
    },
    {
      id: '4',
      name: 'Surgical Gloves',
      sku: 'SG-M',
      category_id: '4',
      category_name: 'Supplies',
      description: 'Medium size surgical gloves',
      unit_type: 'Box (100pcs)',
      current_quantity: 8,
      min_quantity: 3,
      purchase_price: 18.00,
      sale_price: 0.00,
      location: 'Surgery Room Cabinet',
      expiry_date: '2024-05-20',
      batch_number: 'LT456789',
      clinic_id: 1,
      created_at: '2023-01-20',
      updated_at: '2023-08-05',
      is_active: true
    },
    {
      id: '5',
      name: 'Cat Litter',
      sku: 'CL10',
      category_id: '2',
      category_name: 'Food',
      description: 'Premium clumping cat litter',
      unit_type: 'Bag (10kg)',
      current_quantity: 12,
      min_quantity: 5,
      purchase_price: 12.00,
      sale_price: 19.99,
      location: 'Storage Room B',
      expiry_date: null,
      batch_number: null,
      clinic_id: 1,
      created_at: '2023-02-15',
      updated_at: '2023-07-15',
      is_active: true
    }
  ];

  const placeholderCategories: Category[] = [
    { id: '1', name: 'Antibiotics' },
    { id: '2', name: 'Food' },
    { id: '3', name: 'Accessories' },
    { id: '4', name: 'Supplies' },
    { id: '5', name: 'Vaccines' }
  ];

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      // This would normally be a real API call
      // const token = await SecureStore.getItemAsync('userToken');
      // const clinic_id = await SecureStore.getItemAsync('clinicId');
      
      // const response = await fetch(`https://petlyst.com:3001/api/inventory?clinic_id=${clinic_id}`, {
      //   headers: {
      //     Authorization: `Bearer ${token}`,
      //   },
      // });
      
      // const data = await response.json();
      // setInventory(data.items);
      // setFilteredInventory(data.items);
      // setCategories(data.categories);

      // Using placeholder data instead
      setTimeout(() => {
        setInventory(placeholderInventory);
        setFilteredInventory(placeholderInventory);
        setCategories(placeholderCategories);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setIsLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    let filtered = inventory;
    
    // Apply category filter if set
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category_id === selectedCategory);
    }
    
    // Apply text search
    if (text) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(text.toLowerCase()) || 
        item.sku.toLowerCase().includes(text.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(text.toLowerCase()))
      );
    }
    
    setFilteredInventory(filtered);
  };

  const filterByCategory = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    
    if (!categoryId) {
      // Clear filter
      setFilteredInventory(
        searchQuery 
          ? inventory.filter(item => 
              item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
              item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
            )
          : inventory
      );
    } else {
      // Apply category filter
      let filtered = inventory.filter(item => item.category_id === categoryId);
      
      // Also apply search filter if there is one
      if (searchQuery) {
        filtered = filtered.filter(item => 
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      
      setFilteredInventory(filtered);
    }
  };

  const editItem = (item: InventoryItem) => {
    setItemToEdit(item);
    setShowAddModal(true);
  };

  const deleteItem = (itemId: string) => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to delete this item?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          onPress: () => {
            // In a real app, this would make an API call
            // For now, just update the local state
            const updatedInventory = inventory.filter(item => item.id !== itemId);
            setInventory(updatedInventory);
            setFilteredInventory(updatedInventory);
          },
          style: "destructive"
        }
      ]
    );
  };

  const renderCategoryFilter = () => (
    <View style={styles.categoryContainer}>
      <ScrollableButtonGroup 
        items={[{ id: null, name: 'All' }, ...categories]}
        selectedItemId={selectedCategory} 
        onSelect={filterByCategory} 
      />
    </View>
  );

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <TouchableOpacity 
      style={styles.itemCard}
      onPress={() => editItem(item)}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={[
          styles.quantityBadge,
          item.current_quantity <= item.min_quantity ? styles.lowQuantityBadge : {}
        ]}>
          <Text style={styles.quantityText}>{item.current_quantity} {item.unit_type}</Text>
        </View>
      </View>
      
      <View style={styles.itemDetails}>
        <Text style={styles.itemSku}>SKU: {item.sku}</Text>
        <Text style={styles.itemCategory}>{item.category_name}</Text>
      </View>
      
      {item.description && (
        <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
      )}
      
      <View style={styles.itemFooter}>
        <Text style={styles.priceText}>
          Purchase: ${item.purchase_price.toFixed(2)} | Sale: ${item.sale_price.toFixed(2)}
        </Text>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]}
            onPress={() => editItem(item)}
          >
            <Ionicons name="create-outline" size={18} color="#6c63ff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteItem(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>
      
      {item.expiry_date && (
        <View style={styles.expiryContainer}>
          <Text style={styles.expiryText}>Expires: {new Date(item.expiry_date).toLocaleDateString()}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={60} color="#d1d1d6" />
      <Text style={styles.emptyTitle}>No items found</Text>
      <Text style={styles.emptyMessage}>
        {searchQuery || selectedCategory 
          ? "Try adjusting your search or filters"
          : "Add your first inventory item to get started"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6c63ff" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory Management</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#8e8e93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search inventory..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#8e8e93"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#8e8e93" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      
      {renderCategoryFilter()}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredInventory}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={false}
          refreshing={isLoading}
          onRefresh={fetchInventory}
        />
      )}
      
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => {
          setItemToEdit(null);
          setShowAddModal(true);
        }}
      >
        <LinearGradient
          colors={['#6c63ff', '#3b5998']}
          style={styles.addButtonGradient}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
      
      {/* This would be a modal for adding/editing inventory items */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {itemToEdit ? 'Edit Item' : 'Add New Item'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#1c1c1e" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.formMessage}>
              This is a placeholder for the add/edit item form.
              In a real app, there would be form fields here.
            </Text>
            
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.saveButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Scrollable button group component for categories
const ScrollableButtonGroup = ({ 
  items, 
  selectedItemId, 
  onSelect 
}: { 
  items: { id: string | null; name: string }[];
  selectedItemId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12 }}
    >
      {items.map(item => (
        <TouchableOpacity
          key={item.id ?? 'all'}
          style={[
            styles.categoryButton,
            selectedItemId === item.id ? styles.selectedCategoryButton : {}
          ]}
          onPress={() => onSelect(item.id)}
        >
          <Text
            style={[
              styles.categoryButtonText,
              selectedItemId === item.id ? styles.selectedCategoryButtonText : {}
            ]}
          >
            {item.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// Need to import ScrollView for the ScrollableButtonGroup
import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  header: {
    backgroundColor: '#6c63ff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    paddingLeft: 8,
    fontSize: 16,
    color: '#1c1c1e',
  },
  categoryContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f7',
    marginHorizontal: 4,
  },
  selectedCategoryButton: {
    backgroundColor: '#6c63ff',
  },
  categoryButtonText: {
    color: '#1c1c1e',
    fontWeight: '500',
  },
  selectedCategoryButtonText: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8e8e93',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // space for FAB
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#1c1c1e',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    flex: 1,
    marginRight: 8,
  },
  quantityBadge: {
    backgroundColor: '#34c759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lowQuantityBadge: {
    backgroundColor: '#ff3b30',
  },
  quantityText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemSku: {
    fontSize: 14,
    color: '#8e8e93',
  },
  itemCategory: {
    fontSize: 14,
    color: '#6c63ff',
    fontWeight: '500',
  },
  itemDescription: {
    fontSize: 14,
    color: '#1c1c1e',
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    color: '#1c1c1e',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#f0f0f5',
  },
  deleteButton: {
    backgroundColor: '#ffeeee',
  },
  expiryContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  expiryText: {
    fontSize: 12,
    color: '#856404',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#6c63ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  formMessage: {
    fontSize: 16,
    color: '#8e8e93',
    marginBottom: 20,
    textAlign: 'center',
    paddingVertical: 40,
  },
  saveButton: {
    backgroundColor: '#6c63ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default InventoryScreen; 