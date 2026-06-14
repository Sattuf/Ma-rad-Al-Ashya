import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import '../providers/listing_provider.dart';
import '../providers/category_provider.dart';

class CreateListingScreen extends ConsumerStatefulWidget {
  const CreateListingScreen({super.key});

  @override
  ConsumerState<CreateListingScreen> createState() => _CreateListingScreenState();
}

class _CreateListingScreenState extends ConsumerState<CreateListingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _priceController = TextEditingController();
  final _locationController = TextEditingController();

  String? _selectedCategory;
  String _selectedCondition = 'new';
  final List<File> _images = [];
  bool _isLoading = false;

  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImages() async {
    if (_images.length >= 10) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('الحد الأقصى 10 صور')));
      return;
    }

    final List<XFile> picked = await _picker.pickMultiImage();
    if (picked.isNotEmpty) {
      setState(() {
        for (var file in picked) {
          if (_images.length < 10) {
            _images.add(File(file.path));
          }
        }
      });
    }
  }

  void _removeImage(int index) {
    setState(() {
      _images.removeAt(index);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategory == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('يرجى اختيار التصنيف')));
      return;
    }
    if (_images.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('يرجى إضافة صورة واحدة على الأقل')));
      return;
    }

    setState(() => _isLoading = true);

    try {
      final repository = ref.read(listingRepositoryProvider);
      await repository.createListing(
        title: _titleController.text,
        description: _descriptionController.text,
        price: double.parse(_priceController.text),
        categoryId: _selectedCategory!,
        condition: _selectedCondition,
        location: _locationController.text,
        images: _images,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إضافة الإعلان بنجاح')));
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('خطأ: $e')));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('إضافة إعلان جديد'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16.0),
          children: [
            // الصور
            const Text('الصور (حتى 10 صور)', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SizedBox(
              height: 100,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _images.length + 1,
                itemBuilder: (context, index) {
                  if (index == _images.length) {
                    return _images.length < 10
                        ? GestureDetector(
                            onTap: _pickImages,
                            child: Container(
                              width: 100,
                              margin: const EdgeInsets.only(left: 8),
                              decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey[400]!),
                              ),
                              child: const Icon(Icons.add_a_photo, size: 40, color: Colors.grey),
                            ),
                          )
                        : const SizedBox.shrink();
                  }
                  return Stack(
                    children: [
                      Container(
                        width: 100,
                        margin: const EdgeInsets.only(left: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          image: DecorationImage(
                            image: FileImage(_images[index]),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () => _removeImage(index),
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close, size: 16, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'عنوان الإعلان', border: OutlineInputBorder()),
              validator: (val) => val == null || val.isEmpty ? 'مطلوب' : null,
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'الوصف', border: OutlineInputBorder()),
              maxLines: 4,
              validator: (val) => val == null || val.isEmpty ? 'مطلوب' : null,
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _priceController,
              decoration: const InputDecoration(labelText: 'السعر (ريال)', border: OutlineInputBorder()),
              keyboardType: TextInputType.number,
              validator: (val) => val == null || val.isEmpty ? 'مطلوب' : null,
            ),
            const SizedBox(height: 16),

            categoriesAsync.when(
              data: (categories) => DropdownButtonFormField<String>(
                decoration: const InputDecoration(labelText: 'التصنيف', border: OutlineInputBorder()),
                value: _selectedCategory,
                items: categories.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                onChanged: (val) => setState(() => _selectedCategory = val),
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => const Text('خطأ في تحميل التصنيفات'),
            ),
            const SizedBox(height: 16),

            DropdownButtonFormField<String>(
              decoration: const InputDecoration(labelText: 'الحالة', border: OutlineInputBorder()),
              value: _selectedCondition,
              items: const [
                DropdownMenuItem(value: 'new', child: Text('جديد')),
                DropdownMenuItem(value: 'used', child: Text('مستعمل')),
              ],
              onChanged: (val) => setState(() => _selectedCondition = val!),
            ),
            const SizedBox(height: 16),

            TextFormField(
              controller: _locationController,
              decoration: const InputDecoration(labelText: 'الموقع (المدينة / الحي)', border: OutlineInputBorder()),
              validator: (val) => val == null || val.isEmpty ? 'مطلوب' : null,
            ),
            const SizedBox(height: 24),

            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _submit,
                child: _isLoading ? const CircularProgressIndicator() : const Text('نشر الإعلان', style: TextStyle(fontSize: 18)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
